/// JavaScript helper functions

function isNumber(n) {
  // https://stackoverflow.com/a/1421988/631051
  return !isNaN(parseFloat(n)) && !isNaN(n - 0)
}

function ensureNonEmptyValuesUnique(values) {
  const valuesSet = new Set();  // requires V8 engine
  for (var i = 0; i < values.length; i++) {
    var value = values[i].toString().trim();
    if (value.length > 0) {
      if (valuesSet.has(value)) {
        throw ('Duplicate value: ' + value);
      }
      valuesSet.add(value);
    }
  }
}

// https://stackoverflow.com/a/9204568/631051
const EMAIL_REGEX = /\S+@\S+\.\S+/

function isValidEmail(email) {
  return EMAIL_REGEX.test(email);
}
