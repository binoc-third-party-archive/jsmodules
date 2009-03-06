Components.utils.import("resource://jsmodules/Preferences.js");

function test_set_get_pref() {
  Preferences.set("test_set_get_pref.integer", 1);
  do_check_eq(Preferences.get("test_set_get_pref.integer"), 1);

  Preferences.set("test_set_get_pref.string", "foo");
  do_check_eq(Preferences.get("test_set_get_pref.string"), "foo");

  Preferences.set("test_set_get_pref.boolean", true);
  do_check_eq(Preferences.get("test_set_get_pref.boolean"), true);

  // Clean up.
  Preferences.resetBranch("test_set_get_pref.");
}

function test_set_get_multiple_prefs() {
  Preferences.set({ "test_set_get_multiple_prefs.integer":  1,
                    "test_set_get_multiple_prefs.string":   "foo",
                    "test_set_get_multiple_prefs.boolean":  true });

  let [i, s, b] = Preferences.get(["test_set_get_multiple_prefs.integer",
                                   "test_set_get_multiple_prefs.string",
                                   "test_set_get_multiple_prefs.boolean"]);

  do_check_eq(i, 1);
  do_check_eq(s, "foo");
  do_check_eq(b, true);

  // Clean up.
  Preferences.resetBranch("test_set_get_multiple_prefs.");
}

function test_set_get_unicode_pref() {
  Preferences.set("test_set_get_unicode_pref", String.fromCharCode(960));
  do_check_eq(Preferences.get("test_set_get_unicode_pref"), String.fromCharCode(960));

  // Clean up.
  Preferences.reset("test_set_get_unicode_pref");
}

function test_set_null_pref() {
  try {
    Preferences.set("test_set_null_pref", null);
    // We expect this to throw, so the test is designed to fail if it doesn't.
    do_check_true(false);
  }
  catch(ex) {}
}

function test_set_undefined_pref() {
  try {
    Preferences.set("test_set_undefined_pref");
    // We expect this to throw, so the test is designed to fail if it doesn't.
    do_check_true(false);
  }
  catch(ex) {}
}

function test_set_unsupported_pref() {
  try {
    Preferences.set("test_set_unsupported_pref", new Array());
    // We expect this to throw, so the test is designed to fail if it doesn't.
    do_check_true(false);
  }
  catch(ex) {}
}

// Make sure that we can get a string pref that we didn't set ourselves
// (i.e. that the way we get a string pref using getComplexValue doesn't
// hork us getting a string pref that wasn't set using setComplexValue).
function test_get_string_pref() {
  let svc = Cc["@mozilla.org/preferences-service;1"].
            getService(Ci.nsIPrefService).
            getBranch("");
  svc.setCharPref("test_get_string_pref", "a normal string");
  do_check_eq(Preferences.get("test_get_string_pref"), "a normal string");

  // Clean up.
  Preferences.reset("test_get_string_pref");
}

function test_set_get_number_pref() {
  Preferences.set("test_set_get_number_pref", 5);
  do_check_eq(Preferences.get("test_set_get_number_pref"), 5);

  // Non-integer values get converted to integers.
  Preferences.set("test_set_get_number_pref", 3.14159);
  do_check_eq(Preferences.get("test_set_get_number_pref"), 3);

  // Values outside the range -(2^31-1) to 2^31-1 overflow.
  try {
    Preferences.set("test_set_get_number_pref", Math.pow(2, 31));
    // We expect this to throw, so the test is designed to fail if it doesn't.
    do_check_true(false);
  }
  catch(ex) {}

  // Clean up.
  Preferences.reset("test_set_get_number_pref");
}

function test_reset_pref() {
  Preferences.set("test_reset_pref", 1);
  Preferences.reset("test_reset_pref");
  do_check_eq(Preferences.get("test_reset_pref"), undefined);
}

function test_reset_pref_branch() {
  Preferences.set("test_reset_pref_branch.foo", 1);
  Preferences.set("test_reset_pref_branch.bar", 2);
  Preferences.resetBranch("test_reset_pref_branch.");
  do_check_eq(Preferences.get("test_reset_pref_branch.foo"), undefined);
  do_check_eq(Preferences.get("test_reset_pref_branch.bar"), undefined);
}

// Make sure the module doesn't throw an exception when asked to reset
// a nonexistent pref.
function test_reset_nonexistent_pref() {
  Preferences.reset("test_reset_nonexistent_pref");
}

// Make sure the module doesn't throw an exception when asked to reset
// a nonexistent pref branch.
function test_reset_nonexistent_pref_branch() {
  Preferences.resetBranch("test_reset_nonexistent_pref_branch.");
}

function test_observe_prefs_function() {
  let observed = false;
  let observer = function() { observed = !observed };

  Preferences.observe("test_observe_prefs_function", observer);
  Preferences.set("test_observe_prefs_function", "something");
  do_check_true(observed);

  Preferences.ignore("test_observe_prefs_function", observer);
  Preferences.set("test_observe_prefs_function", "something else");
  do_check_true(observed);

  // Clean up.
  Preferences.reset("test_observe_prefs_function");
}

function test_observe_prefs_object() {
  let observer = {
    observed: false,
    observe: function() {
      this.observed = !this.observed;
    }
  };

  Preferences.observe("test_observe_prefs_object", observer.observe, observer);
  Preferences.set("test_observe_prefs_object", "something");
  do_check_true(observer.observed);

  Preferences.ignore("test_observe_prefs_object", observer.observe, observer);
  Preferences.set("test_observe_prefs_object", "something else");
  do_check_true(observer.observed);

  // Clean up.
  Preferences.reset("test_observe_prefs_object");
}

function test_observe_prefs_nsIObserver() {
  let observer = {
    observed: false,
    observe: function(subject, topic, data) {
      this.observed = !this.observed;
      do_check_true(subject instanceof Ci.nsIPrefBranch2);
      do_check_eq(topic, "nsPref:changed");
      do_check_eq(data, "test_observe_prefs_nsIObserver");
    }
  };

  Preferences.observe("test_observe_prefs_nsIObserver", observer);
  Preferences.set("test_observe_prefs_nsIObserver", "something");
  do_check_true(observer.observed);

  Preferences.ignore("test_observe_prefs_nsIObserver", observer);
  Preferences.set("test_observe_prefs_nsIObserver", "something else");
  do_check_true(observer.observed);

  // Clean up.
  Preferences.reset("test_observe_prefs_nsIObserver");
}

function test_observe_exact_pref() {
  let observed = false;
  let observer = function() { observed = !observed };

  Preferences.observe("test_observe_exact_pref", observer);
  Preferences.set("test_observe_exact_pref.sub-pref", "something");
  do_check_false(observed);

  // Clean up.
  Preferences.ignore("test_observe_exact_pref", observer);
  Preferences.reset("test_observe_exact_pref.sub-pref");
}

function test_observe_value_of_set_pref() {
  let observer = function(newVal) { do_check_eq(newVal, "something") };

  Preferences.observe("test_observe_value_of_set_pref", observer);
  Preferences.set("test_observe_value_of_set_pref", "something");

  // Clean up.
  Preferences.ignore("test_observe_value_of_set_pref", observer);
  Preferences.reset("test_observe_value_of_set_pref");
}

function test_observe_value_of_reset_pref() {
  let observer = function(newVal) { do_check_true(typeof newVal == "undefined") };

  Preferences.set("test_observe_value_of_reset_pref", "something");
  Preferences.observe("test_observe_value_of_reset_pref", observer);
  Preferences.reset("test_observe_value_of_reset_pref");

  // Clean up.
  Preferences.ignore("test_observe_value_of_reset_pref", observer);
}
