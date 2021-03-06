//// Business logic for CreateClass and AddStudents

// These 3 column numbers must not be changed without changing getNamesAndEmails().
const NAME_COLUMN_NUMBER = 1;
const NAME_COLUMN_NAME = 'name';
const NAME_ERROR_MESSAGE = 'The top cell in the first column must be "Name".';
const EMAIL_COLUMN_NUMBER = 2;
const EMAIL_COLUMN_NAME = 'email';
const EMAIL_ERROR_MESSAGE = 'The top cell in the second column must be "Email".';
const URL_COLUMN_NUMBER = 3;
const URL_ERROR_MESSAGE = 'The third column should be empty.';
const IS_VALIDATED_KEY = 'validated';

// returns [names, emails, flags] if good; otherwise throws exception.
// Flags array indicates whether to create folder for the corresponding name/email.
function validateStudentSetupSheet(initial) {
  setIsValidated(false);
  deleteTriggers();
  const thisSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  checkColumnHeader(thisSheet, NAME_COLUMN_NUMBER, NAME_COLUMN_NAME, NAME_ERROR_MESSAGE);
  checkColumnHeader(thisSheet, EMAIL_COLUMN_NUMBER, EMAIL_COLUMN_NAME, EMAIL_ERROR_MESSAGE);

  // Ensure same number of names and email addresses.
  const maxNameRow = findBlankInColumn(thisSheet, NAME_COLUMN_NUMBER) - 1;
  const maxEmailRow = findBlankInColumn(thisSheet, EMAIL_COLUMN_NUMBER) - 1;
  if (maxNameRow > maxEmailRow) {
    throw ('You have more names (' + (maxNameRow - 1) + ') than email addresses (' + (maxEmailRow - 1) + ').');
  }
  if (maxNameRow < maxEmailRow) {
    throw ('You have more email addresses (' + (maxEmailRow - 1) + ') than email addresses (' + (maxNameRow - 1) + ').');
  }

  // Extract names and emails.
  if (initial && !isColumnBlank(thisSheet, maxNameRow, URL_COLUMN_NUMBER)) {
    // When adding to an existing class, the URL column need not be blank.
    throw (URL_ERROR_MESSAGE);
  }
  const namesAndEmails = getNamesAndEmails(thisSheet, maxNameRow);
  const names = namesAndEmails[0];
  const emails = namesAndEmails[1];
  const flags = namesAndEmails[2];
  ensureNonEmptyValuesUnique(names);
  ensureNonEmptyValuesUnique(emails);
  ensureEmailsValid(emails);

  setIsValidated(true);
  addTrigger();
  return [names, emails, flags];
}

function ensureEmailsValid(emails) {
  for (var i = 0; i < emails.length; i++) {
    if (!isValidEmail(emails[i])) {
      throw ('Invalid email address: ' + emails[i]);
    }
  }
}

// Gets names and email addresses from the respective columns. This also returns an array of booleans
// indicating whether a new folder should be created, based on the value of the URL column.
// This assumes that NAME_COLUMN_NUMBER, EMAIL_COLUMN_NUMBER, and URL_COLUMN_NUMBER are adjacent (e.g., 1, 2, 3).
function getNamesAndEmails(sheet, maxRow) {
  const values = sheet.getRange(2, NAME_COLUMN_NUMBER, maxRow - 1, 3).getValues();
  const names = new Array(maxRow - 1);
  const emails = new Array(maxRow - 1);
  const flags = new Array(maxRow - 1);
  for (var i = 0; i < values.length; i++) {
    names[i] = values[i][0].toString().trim();
    emails[i] = values[i][1].toString().trim();
    flags[i] = values[i][URL_COLUMN_NUMBER - NAME_COLUMN_NUMBER].toString().trim().length == 0;
  }

  return [names, emails, flags];
}

function getIsValidated() {
  return PropertiesService.getScriptProperties().getProperty(IS_VALIDATED_KEY) === 'true';
}

function setIsValidated(value) {
  PropertiesService.getScriptProperties().setProperty(IS_VALIDATED_KEY, value);
}

function deleteTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}

function addTrigger() {
  deleteTriggers();
  if (ScriptApp.getProjectTriggers().length == 0) {
    ScriptApp.newTrigger("respondToEdit")
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create()
  }
}

function respondToEdit(e) {
  setIsValidated(false);
}

function createClass(topFolderName, prefix, suffix, giveEditAccess, emailStudent) {
  // Double-check that data is valid and get names and emails.
  const arr = validateStudentSetupSheet();
  const names = arr[0];
  const emails = arr[1];
  const flags = arr[2];

  // Create configuration file, or throw error if it already exists.
  const thisSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const currentFolder = DriveApp.getFileById(thisSpreadsheet.getId()).getParents().next();
  const studentsFolder = createFolderIfNotPresent(currentFolder, topFolderName);
  createConfigurationSheet(thisSpreadsheet, studentsFolder.getId(), prefix, suffix);

  // Create student folders, adding the URLs to the spreadsheet.
  const thisSheet = thisSpreadsheet.getActiveSheet();
  return numStudents = createStudentFoldersAndUpdateSheet(thisSheet, studentsFolder, prefix, suffix, giveEditAccess, emailStudent, names, emails, flags);
}

function addStudentSheets(giveEditAccess, emailStudent) {
  const thisSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const thisSheet = thisSpreadsheet.getActiveSheet();

  // Before creating student folders, find and extract information from configuration file.
  const configurationFile = getConfigurationFile(thisSpreadsheet, false);
  if (configurationFile === null) {
    throw ('Unable to find file named "' + CONFIGURATION_FILE_NAME +
      '", which should have been created when the class was created. Make sure you are in the same folder.');
  }
  const configuration = getConfigurationFromFile(configurationFile);
  const studentsFolderId = configuration[0];
  const studentsFolder = DriveApp.getFolderById(studentsFolderId);
  const prefix = configuration[1];
  const suffix = configuration[2];

  // Double-check that data is valid and get names and emails.
  const arr = validateStudentSetupSheet();
  const names = arr[0];
  const emails = arr[1];
  const flags = arr[2];

  // Create student folders and return count.
  return createStudentFoldersAndUpdateSheet(thisSheet, studentsFolder, prefix, suffix, giveEditAccess, emailStudent, names, emails, flags);
}

function createStudentFoldersAndUpdateSheet(thisSheet, studentsFolder, prefix, suffix, giveEditAccess, emailStudent, names, emails, flags) {
  var numStudents = 0;
  const urlRange = thisSheet.getRange(1, URL_COLUMN_NUMBER, names.length + 1, 1);
  urlRange.getCell(1, 1).setValue('Folder URL');
  for (var i = 0; i < names.length; i++) {
    const name = names[i];
    if (flags[i]) {
      const childFolderName = prefix + name + suffix;
      const childFolder = studentsFolder.createFolder(childFolderName);
      const email = emails[i];
      try {
        addUserPermission(childFolder.getId(), email, giveEditAccess, emailStudent);
        urlRange.getCell(i + 2, 1).setValue(childFolder.getUrl());
        toast('Created folder for ' + name);
        numStudents++;
      } catch (e) {
        childFolder.setTrashed(true);
        urlRange.getCell(i + 2, 1).setValue(e.toString());
      }
    }
  }
  return numStudents
}
