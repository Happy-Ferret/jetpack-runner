const fs = require("fs");
const path = require("path");
const process = require("process");
const { OS } = require("api-utils/runtime");

/* 
 * Return an array containing path of all mozilla binaries found
 *   by mozilla binaries we say Firefox, Thunderbird, Xulrunner
 */
exports.findBinaries = function () {
  let binaries = [];
  
  if (OS === 'WINNT' && process.env.ProgramFiles) {
    // We can't be anywhere else than windows with such env var
    let possibleNames = ["firefox", "thunderbird", "xulrunner"];
    
    let searchDirs = [process.env.ProgramFiles];
    // For some obscur reason ProgramFiles is equal to ProgramFiles(x86)
    // ProgramW6432 allow to retrieve "c:\program files\"
    let pf = process.env["ProgramFiles(x86)"];
    if (pf && searchDirs.indexOf(pf)==-1)
      searchDirs.push(pf);
    pf = process.env["ProgramW6432"];
    if (pf && searchDirs.indexOf(pf)==-1)
      searchDirs.push(pf);
    
    for(let x=0; x<searchDirs.length; x++) {
      let dir = searchDirs[x];
      let subDirs = fs.readdirSync(dir);
      for(let i=0; i<subDirs.length; i++) {
        let subDir = subDirs[i];
        if (!subDir.match(/Mozilla|Firefox|Thunderbird|Minefield/)) continue;
        for(let j=0; j<possibleNames.length; j++) {
          let exe = path.join(dir, subDir, possibleNames[j] + ".exe")
          if (path.existsSync(exe))
            binaries.push(exe);
        }
      }
    }
  }
  else if (OS === 'Darwin') {
    let possibleNames = [ "Firefox", "Thunderbird", "Xulrunner" ]
    let searchDirs = [ "/Applications", "~/Applications" ]
    binaries = searchDirs.reduce(function (binaries, dir) {
      return binaries.concat(possibleNames.map(function(name) {
        return path.join(name + '.app', 'Contents', 'MacOS',
                         name.toLowerCase() + '-bin')
      }).map(function(binary) {
        return path.join(dir, binary)
      }).filter(function(binary) {
        return path.existsSync(binary)
      }))
    }, binaries)
  }
  else {
    // Else search in PATH on linux and mac
    let possibleNames = ["firefox", "firefox-4.0", "mozilla-firefox", "iceweasel",
                         "thunderbird", "xulrunner"];
    let pathList = process.env.PATH.split(':');
    for(let i=0; i<pathList.length; i++) {
      for(let j=0; j<possibleNames.length; j++) {
        let binary = path.join(pathList[i], possibleNames[j]);
        if (!path.existsSync(binary)) 
          continue;
        if (fs.statSync(binary).isSymbolicLink())
          binary = fs.readlinkSync(binary);
        binaries.push(binary);
      }
    }
  }
  
  // For both OS, try to add currently used binary if that one is not
  // already added. And add it first.
  let binary = exports.getCurrentProcessBinary();
  if (binary) {
    let idx = binaries.indexOf(binary);
    if (idx!=-1)
      binaries.splice(idx, 1);
    binaries.unshift(binary);
    
  }
  
  return binaries;
}

exports.getCurrentProcessBinary = function () {
  let binary = process.argv[0];
  if (path.existsSync(binary))
    return binary;
  return null;
}

exports.getBestBinary = function () {
  let current = exports.getCurrentProcessBinary();
  if (current) 
    return current;
  
  let binaries = exports.findBinaries();
  for(let i=0; i<binaries.length; i++) {
    let info;
    try {
      info = exports.getInfo(binaries[i]);
    } catch(e) {
      continue;
    }
    console.log("INFO : "+info.toSource());
    if (parseInt(info.version.charAt(0)) >= 4)
      return binaries[i];
  }
}

/*
 * Get extra informations by giving a mozilla binary path
 *  {
 *    name: name of mozilla aplication,
 *    version: version number of this application
 *  }
 */
exports.getInfo = function (binary) {
  let applicationIni = path.join(binary, "..", "application.ini");
  if (!path.existsSync(applicationIni))
    throw new Error("Unable to found application.ini for this binary : "+binary);
  let content = fs.readFileSync(applicationIni);
  return {
    name: content.match(/Name=([^\s]+)/)[1],
    version: content.match(/Version=([^\s]+)/)[1],
  }
}
