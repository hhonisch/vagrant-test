// Registry object
var regWmiConn;

// Shell object
var wshShell;


// Get wshShell
function getWshShell() {
  if (!wshShell) {
    wshShell = new ActiveXObject("WScript.Shell");
  }
  return wshShell;
}


// Log message
function log(msg) {
  WScript.stdout.writeLine(msg);
}


// Trim whitespaces
function trim(str) {
  return str.replace(/^\s*|\s*$/g, "");
}


// Get registry WMI connection
function getRegWmiConn() {
  if (!regWmiConn) {
    // Connect to registry
    var regWmiConn = GetObject("winmgmts://./root/default:StdRegProv")
  }
  return regWmiConn;
}


// Get registry keys
function regGetKeys(regPath) {

  var reg = getRegWmiConn();

  // Split path into root key and sub path
  var m = regPath.match(/^(.*?)\\(.*$)/);
  var rootKeyName, subKeyPath;
  if (m) {
    rootKeyName = m[1];
    subKeyPath = m[2];
  } else {
    throw new Error("Invalid registry path: " + regPath);
  }

  var rootKey = 0;
  if (rootKeyName.match(/^HKLM|HKEY_LOCAL_MACHINE$/i)) {
    rootKey = 0x80000002;
  } else if (rootKeyName.match(/^HKCU|HKEY_CURRENT_USER/i)) {
    rootKey = 0x80000001;
  } else {
    throw new Error("Invalid registry root key: " + rootKeyName);
  }

  // Enumerate sub keys
  var inx = reg.Methods_("EnumKey").InParameters.SpawnInstance_();
  inx.hDefKey = rootKey;
  inx.sSubKeyName = subKeyPath;
  var out = reg.ExecMethod_("EnumKey", inx);
  if (out.ReturnValue) {
    throw new Error(out.ReturnValue, "Error code: " + out.ReturnValue);
  }

  // Return array of keys
  return out.sNames.toArray();
}


// Read registry value
function regReadValue(regPath, regValueName) {
  var wsh = getWshShell();
  return wsh.RegRead(regPath + "\\" + regValueName);
}


// Write registry value
function regWriteValue(regPath, regValueName, regValue, regValueType) {
  var wsh = getWshShell();
  if (regValueType) {
    wsh.RegWrite(regPath + "\\" + regValueName, regValue, regValueType);
  } else {
    wsh.RegWrite(regPath + "\\" + regValueName, regValue);
  }
}


// Delete registry key
function regDeleteKey(regPath) {
  var wsh = getWshShell();
  wsh.RegDelete(regPath + "\\");
}


// Set netconnection profle
function setNetConnectionProfile(location) {

  log("Setting network connection profile");
  var locName = trim(location.toLowerCase());
  var locDesc;
  if (locName == "private") {
    locDesc = "Private";
  } else if (locName == "public") {
    locDesc = "Public";
  } else {
    throw new Error("Unsupported location: " + locName);
  }

  // Iterate profiles
  var regProfilesPath = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\NetworkList\\Profiles";
  var profilesKeys = regGetKeys(regProfilesPath);
  for (var i = 0; i < profilesKeys.length; i++) {
    var regProfilePath = regProfilesPath + "\\" + profilesKeys[i];
    var profileName = regReadValue(regProfilePath, "ProfileName");
    log("  Profile: " + profileName + " => setting location to " + locDesc);
    if (locName == "public") {
      regWriteValue(regProfilePath, "Category", 0);
    } else if (locName == "private") {
      regWriteValue(regProfilePath, "Category", 1, "REG_DWORD");
      regWriteValue(regProfilePath, "CategoryType", 0, "REG_DWORD");
      regWriteValue(regProfilePath, "IconType", 0, "REG_DWORD");
    } else {
      throw new Error("Invalid location: " + locName);
    }
  }
}


// Clear netconnection profles
function clearNetConnectionProfiles() {

  log("Clearing network connection profiles");

  // Iterate profiles
  var regProfilesPath = "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\NetworkList\\Profiles";
  var profilesKeys = regGetKeys(regProfilesPath);
  for (var i = 0; i < profilesKeys.length; i++) {
    var regProfilePath = regProfilesPath + "\\" + profilesKeys[i];
    var profileName = regReadValue(regProfilePath, "ProfileName");
    log("  Removing profile: " + profileName);
    regDeleteKey(regProfilePath);
  }
}


// Install Windows Updates
// Possible return values:
//   0: Updates were installed successfully
//   2: Updates were installed successfully, reboot is required
//   3: No updates found
function installWindowsUpdates(maxUpdates) {

  log("Installing Windows Updates...");

  if (maxUpdates) {
    log("  Max Windows Update batch size: " + maxUpdates);
  }

  // New update session
  var updateSession = new ActiveXObject("Microsoft.Update.Session");
  updateSession.ClientApplicationID = "MSDN Sample Script";

  // Search for updates
  log("  Searching for updates...");
  try {
    var updateSearcher = updateSession.CreateUpdateSearcher();
    var searchResult = updateSearcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0 and BrowseOnly=0");
  } catch (e) {
    log("  Error while searching for updates: " + e.number + " " + e.description);
    log("  Rebooting and trying again...");
    return 2;
  }

  // List updates
  log("  List of applicable items on the machine:");
  for (var i = 0; i < searchResult.Updates.Count; i++) {
    update = searchResult.Updates.Item(i);
    log("  " + (i + 1).toString() + ": " + update.Title);
  }
  if (searchResult.Updates.Count == 0) {
    log("  There are no applicable updates.");
    return 3;
  }

  // Prepare list of updates to download
  log("Creating collection of updates to download:");
  var updatesToDownload = new ActiveXObject("Microsoft.Update.UpdateColl");
  for (var i = 0; i < searchResult.Updates.Count; i++) {
    var update = searchResult.Updates.Item(i);

    // Check for Update requiring user input
    if (update.InstallationBehavior.CanRequestUserInput) {
      log("  " + (i + 1).toString() + ": Skipping because it requires user input: " + update.Title);
      continue;
    }

    // Check for EULA
    if (!update.EulaAccepted) {
      log("  " + (i + 1).toString() + ": Accepting EULA: " + update.Title);
      update.AcceptEula();
    }

    // Add update to download list
    log("  " + (i + 1).toString() + ": Adding to download list: " + update.Title);
    updatesToDownload.Add(update);

    // Observer max batch size
    if (maxUpdates) {
      if (updatesToDownload.Count >= maxUpdates) {
        log("  Max batch size reached");
        break;
      }
    }
  }

  // If no updates were selected for download => finished
  if (updatesToDownload.Count == 0) {
    log("  All applicable updates were skipped");
    // Result "3" indicates "no updates found"
    return 3;
  }

  // Downloading updates
  log("Downloading updates...");
  var downloader = updateSession.CreateUpdateDownloader();
  downloader.Updates = updatesToDownload;
  try {
    downloader.Download();
  } catch (e) {
    log("  Error while downloading updates: " + e.number + " " + e.description);
    log("  Rebooting and trying again...");
    return 2;
  }

  // Check downloaded updates
  var updatesToInstall = new ActiveXObject("Microsoft.Update.UpdateColl");
  var rebootMayBeRequired = false;

  log("Successfully downloaded updates:");
  for (var i = 0; i < searchResult.Updates.Count; i++) {
    var update = searchResult.Updates.Item(i);
    if (update.IsDownloaded) {
      log("  " + (i + 1).toString() + ": " + update.Title);
      updatesToInstall.Add(update);
      if (update.InstallationBehavior.RebootBehavior > 0) {
        rebootMayBeRequired = true;
      }
    }
  }

  // If no updates were downloaded successfully => reboot and retry
  if (updatesToInstall.Count == 0) {
    log("  No updates were successfully downloaded => reboot and retry");
    // Result "2" indicates "reboot required"
    return 2;
  }
  // Check if reboot may be required
  if (rebootMayBeRequired) {
    log("  Reboot may be required");
  }

  // Install updates
  log("  Installing updates...");
  var installer = updateSession.CreateUpdateInstaller();
  installer.Updates = updatesToInstall;
  try {
    installationResult = installer.Install();
  } catch (e) {
    log("  Error while installing Windows updates: " + e.number + " " + e.description);
    log("  Rebooting and trying again...");
    return 2;
  }

  // Installation results
  log("  Installation Result: " + installationResult.ResultCode.toString());
  log("  Reboot Required: " + (installationResult.RebootRequired ? "true" : "false"));
  log("  Installed updates and install results:");
  for (var i = 0; i < updatesToInstall.Count; i++) {
    var update = updatesToInstall.Item(i);
    log("  " + (i + 1).toString() + ": " + update.Title + ": "
      + installationResult.GetUpdateResult(i).ResultCode);
  }
  if (installationResult.RebootRequired) {
    // Result "2" indicates "reboot required"
    log("  Finished installing updates, reboot is required");
    return 2;
  } else {
    // Result "0" indicates "Updates successfully installed"
    log("  Finished installing updates");
    return 0;
  }
}


// Exec command
function execCommand(cmd, params) {
  if (cmd == "setnetconnectionprofile") {
    return setNetConnectionProfile(params["location"]);
  } else if (cmd == "clearnetconnectionprofiles") {
    return clearNetConnectionProfiles();
  } else if (cmd == "installwindowsupdates") {
    return installWindowsUpdates(params["maxupdates"]);
  } else {
    throw new Error("Unknown command: " + cmd);
  }
}


// Main function
function main() {

  var m, s, paramKey, paramValue;
  var namedParams = {};

  // Parse parameters
  for (var i = 0; i < WScript.arguments.length; i++) {
    s = WScript.arguments(i).toString();

    // Parse "/key:value"
    m = s.match(/^\/(.*?):(.*)$/i);
    if (m) {
      paramKey = trim(m[1]).toLowerCase();
      paramValue = m[2];
      namedParams[paramKey] = paramValue;
      continue;
    }

    // Parse "/key"
    m = s.match(/^\/(.*)$/i);
    if (m) {
      paramKey = trim(m[1]).toLowerCase();
      namedParams[paramKey] = true;
      continue;
    }
  }

  // Check for command
  var result = 0;
  if (!namedParams["cmd"]) {
    throw new Error("Missing command");
  } else {
    res = execCommand(namedParams["cmd"].toLowerCase(), namedParams);
    if (typeof (res) == "boolean") {
      result = (res ? 0 : -1);
    } else if (typeof (res) == "number") {
      result = res;
    }
  }

  log("\r\nDone (Result:" + result.toString() + ")");
  return result;
}

// On uncaught exception, WSH exits with exit code "1"
WScript.Quit(main());
