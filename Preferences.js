/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Preferences.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Myk Melez <myk@mozilla.org>
 *   Daniel Aquino <mr.danielaquino@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let EXPORTED_SYMBOLS = ["Preferences"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// The minimum and maximum integers that can be set as preferences.
// The range of valid values is narrower than the range of valid JS values
// because the native preferences code treats integers as NSPR PRInt32s,
// which are 32-bit signed integers on all platforms.
const MAX_INT = Math.pow(2, 31) - 1;
const MIN_INT = -MAX_INT;

function Preferences(prefBranch) {
  if (prefBranch)
    this._prefBranch = prefBranch;
}

Preferences.prototype = {
  _prefBranch: "",

  // Preferences Service

  get _prefSvc() {
    let prefSvc = Cc["@mozilla.org/preferences-service;1"].
                  getService(Ci.nsIPrefService).
                  getBranch(this._prefBranch).
                  QueryInterface(Ci.nsIPrefBranch2);
    this.__defineGetter__("_prefSvc", function() prefSvc);
    return this._prefSvc;
  },

  /**
    * Get the value of a pref, if any; otherwise return the default value.
    *
    * @param   prefName      the name of the pref to get
    * @param   defaultValue  the default value, if any
    *
    * @returns the value of the pref, if any; otherwise the default value
    */
  get: function(prefName, defaultValue) {
    if (isArray(prefName))
      return prefName.map(function(v) this.get(v), this);

    switch (this._prefSvc.getPrefType(prefName)) {
      case Ci.nsIPrefBranch.PREF_STRING:
        return this._prefSvc.getComplexValue(prefName, Ci.nsISupportsString).data;

      case Ci.nsIPrefBranch.PREF_INT:
        return this._prefSvc.getIntPref(prefName);

      case Ci.nsIPrefBranch.PREF_BOOL:
        return this._prefSvc.getBoolPref(prefName);

      case Ci.nsIPrefBranch.PREF_INVALID:
      default:
        return defaultValue;
    }
  },

  /**
   * Set a preference to a value.
   *
   * @param   prefName  {String}
   *          the name of the pref to set
   *
   * @param   prefValue {String|Number|Boolean}
   *          the value to which to set the pref
   *
   * Note: Preferences cannot store non-integer numbers or numbers outside
   * the signed 32-bit range -(2^31-1) to 2^31-1, If you have such a number,
   * store it as a string by calling toString() on the number before passing
   * it to this method, i.e.:
   *   Preferences.set("pi", 3.14159.toString())
   *   Preferences.set("big", Math.pow(2, 31).toString()).
   */
  set: function(prefName, prefValue) {
    if (isObject(prefName)) {
      for (let [name, value] in Iterator(prefName))
        this.set(name, value);
      return;
    }

    let prefType;
    if (typeof prefValue != "undefined" && prefValue != null)
      prefType = prefValue.constructor.name;

    switch (prefType) {
      case "String":
        {
          let string = Cc["@mozilla.org/supports-string;1"].
                       createInstance(Ci.nsISupportsString);
          string.data = prefValue;
          this._prefSvc.setComplexValue(prefName, Ci.nsISupportsString, string);
        }
        break;

      case "Number":
        this._prefSvc.setIntPref(prefName, prefValue);
        if (prefValue > MAX_INT || prefValue < MIN_INT)
          Cu.reportError("Warning: setting the " + prefName + " pref to the " +
                         "large number " + prefValue + " corrupted it to the " +
                         "smaller number " + this.get(prefName) + ", as it is " +
                         "outside the 32-bit range -(2^31-1) to 2^31-1; " +
                         "to retain the original value, store it as a string.");
        if (prefValue % 1 != 0)
          Cu.reportError("Warning: setting the " + prefName + " pref to the " +
                         "non-integer number " + prefValue + " converted it " +
                         "to the integer number " + this.get(prefName) +
                         "; to retain fractional precision, store non-integer " +
                         "numbers as strings.");
        break;

      case "Boolean":
        this._prefSvc.setBoolPref(prefName, prefValue);
        break;

      default:
        throw "can't set pref " + prefName + " to value '" + prefValue +
              "'; it isn't a String, Number, or Boolean";
    }
  },

  reset: function(prefName) {
    if (isArray(prefName)) {
      prefName.map(function(v) this.reset(v), this);
      return;
    }

    try {
      this._prefSvc.clearUserPref(prefName);
    }
    catch(ex) {
      // The pref service throws NS_ERROR_UNEXPECTED when the caller tries
      // to reset a pref that doesn't exist or is already set to its default
      // value.  This interface fails silently in those cases, so callers
      // can unconditionally reset a pref without having to check if it needs
      // resetting first or trap exceptions after the fact.  It passes through
      // other exceptions, however, so callers know about them, since we don't
      // know what other exceptions might be thrown and what they might mean.
      if (ex.result != Cr.NS_ERROR_UNEXPECTED)
        throw ex;
    }
  },


  /**
   * Observe a pref branch.  The callback can be a function, a method
   * (when thisObject is provided), or any object that implements nsIObserver.
   * The pref branch can be any string and is appended to the root branch
   * for the Preferences instance on which this method is called.
   *
   * For example, if the Preferences instance has root branch "foo.",
   * and this method is called with branch "bar.", then the callback
   * will observe the complete branch "foo.bar.". If the Preferences instance
   * has the root branch "", and this method is called with branch "",
   * then the callback will observe changes to all preferences.
   *
   * @param   branch      {String}  [optional]
   *          the branch to observe
   *
   * @param   callback    {Object}
   *          the callback to call when a pref on the branch changes;
   *          a Function or an Object that implements nsIObserver
   *
   * @param   thisObject  {Object}  [optional]
   *          the object to use as |this| when calling a Function callback;
   *          allows the callback to behave like a method when observing changes
   *
   * @returns the wrapped observer
   */
  observe: function(branch, callback, thisObject) {
    let fullBranch = this._prefBranch + (branch || "");

    let observer = new PrefObserver(fullBranch, callback, thisObject);
    Preferences._prefSvc.addObserver(fullBranch, observer, true);
    observers.push(observer);

    return observer;
  },

  /**
   * Stop observing a pref branch.  This method must be called with the same
   * branch, callback, and thisObject with which the observer was originally
   * registered.  However, you don't have to call this method on the same
   * exact instance of Preferences.  You can call it on any instance.
   *
   * @param   branch      {String}  [optional]
   *          the branch being observed
   *
   * @param   callback    {Object}
   *          the callback doing the observing
   *
   * @param   thisObject  {Object}  [optional]
   *          the object being used as |this| when calling a Function callback
   */
  ignore: function(branch, callback, thisObject) {
    let fullBranch = this._prefBranch + (branch || "");

    // This seems fairly inefficient, but I'm not sure how much better we can
    // make it.  We could index by fullBranch, but we can't index by callback
    // or thisObject, as far as I know, since the keys to JavaScript hashes
    // (a.k.a. objects) can apparently only be primitive values.
    let [observer] =
      observers.filter(function(v) v.branch     == fullBranch &&
                                   v.callback   == callback &&
                                   v.thisObject == thisObject);

    if (observer) {
      Preferences._prefSvc.removeObserver(fullBranch, observer);
      observers.splice(observers.indexOf(observer), 1);
    }
  },


  // FIXME: make the methods below accept an array of pref names.

  has: function(prefName) {
    return (this._prefSvc.getPrefType(prefName) != Ci.nsIPrefBranch.PREF_INVALID);
  },

  // FIXME: change this to isSet (for consistency with set and reset).
  modified: function(prefName) {
    return (this.has(prefName) && this._prefSvc.prefHasUserValue(prefName));
  },

  locked: function(prefName) {
    return this._prefSvc.isLocked(prefName);
  },

  lock: function(prefName) {
    this._prefSvc.lockPref(prefName);
  },

  unlock: function(prefName) {
    this._prefSvc.unlockPref(prefName);
  },

  resetBranch: function(prefBranch) {
    try {
      this._prefSvc.resetBranch(prefBranch);
    }
    catch(ex) {
      // The current implementation of nsIPrefBranch in Mozilla
      // doesn't implement resetBranch, so we do it ourselves.
      if (ex.result == Cr.NS_ERROR_NOT_IMPLEMENTED)
        this.reset(this._prefSvc.getChildList(prefBranch, []));
      else
        throw ex;
    }
  }

};

// Give the constructor the same prototype as its instances, so users can access
// preferences directly via the constructor without having to create an instance
// first.
Preferences.__proto__ = Preferences.prototype;

/**
 * A cache of preference observers.
 *
 * We use this to remove observers when a caller calls |remove|.
 *
 * All Preferences instances share this object, because we want callers
 * to be able to remove an observer using a different Preferences object
 * than the one with which they added it.  That means we have to provide
 * the observers in this object their complete pref branch, not just
 * the branch relative to the root branch of any given Preferences object.
 */
let observers = [];

function PrefObserver(branch, callback, thisObject) {
  this.branch = branch;
  this.callback = callback;
  this.thisObject = thisObject;
}

PrefObserver.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    if (typeof this.callback == "function") {
      if (this.thisObject)
        this.callback.call(this.thisObject);
      else
        this.callback();
    }
    else // typeof this.callback == "object" (nsIObserver)
      this.callback.observe(subject, topic, data);
  }
};

function isArray(val) {
  // We can't check for |val.constructor == Array| here, since the value
  // might be from a different context whose Array constructor is not the same
  // as ours, so instead we match based on the name of the constructor.
  return (typeof val != "undefined" && val != null && typeof val == "object" &&
          val.constructor.name == "Array");
}

function isObject(val) {
  // We can't check for |val.constructor == Object| here, since the value
  // might be from a different context whose Object constructor is not the same
  // as ours, so instead we match based on the name of the constructor.
  return (typeof val != "undefined" && val != null && typeof val == "object" &&
          val.constructor.name == "Object");
}
