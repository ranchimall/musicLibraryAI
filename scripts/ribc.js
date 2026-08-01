(function () {
    const Ribc = window.RIBC = {};
    const Admin = Ribc.admin = {};

    Ribc.init = function (isSubAdmin = false) {
        return new Promise((resolve, reject) => {
            Promise.all([Ribc.refreshObjectData(), Ribc.refreshGeneralData(isSubAdmin)])
                .then(results => resolve(results))
                .catch(error => reject(error))
        })
    }

    Ribc.refreshObjectData = () => {
        return new Promise((resolve, reject) => {
            floCloudAPI.requestObjectData("VideoMarketplace").then(result => {
                if (!floGlobals.appObjects.VideoMarketplace)
                    floGlobals.appObjects.VideoMarketplace = {};
                var objectList = ["projectMap", "projectBranches", "projectTaskDetails", "projectDetails", "creatorList", "creatorRating", "creatorRecord", "creatorsAssigned", "projectTaskStatus", "displayedTasks"]
                objectList.forEach(obj => {
                    if (!floGlobals.appObjects.VideoMarketplace[obj])
                        floGlobals.appObjects.VideoMarketplace[obj] = obj === "displayedTasks" ? [] : {};
                    _[obj] = floGlobals.appObjects.VideoMarketplace[obj];
                });
                //_.projectMap = floGlobals.appObjects.VideoMarketplace.projectMap;
                //this.lastCommit = JSON.stringify(floGlobals.appObjects.VideoMarketplace);
                resolve('Object Data Refreshed Successfully')
            }).catch(error => reject(error))
        })
    }

    Ribc.refreshGeneralData = (isSubAdmin) => {
        return new Promise((resolve, reject) => {
            var generalDataList = ["CreatorUpdates"],
                subAdminOnlyList = [],
                selfOnlyList = [];
            (isSubAdmin ? generalDataList : selfOnlyList).push("TaskRequests", "CreatorRequests");
            let promises = [];
            for (let data of generalDataList)
                promises.push(floCloudAPI.requestGeneralData(data))
            for (let data of subAdminOnlyList)
                promises.push(floCloudAPI.requestGeneralData(data, {
                    senderID: floGlobals.subAdmins
                }));
            for (let data of selfOnlyList)
                promises.push(floCloudAPI.requestGeneralData(data, {
                    senderID: floDapps.user.id
                }));
            Promise.all(promises)
                .then(results => resolve('General Data Refreshed Successfully'))
                .catch(error => reject(error))
        })
    }

    const _ = {}; //private variable holder

    Ribc.applyForCreator = (details) => new Promise((resolve, reject) => {
        floCloudAPI.sendGeneralData(details, "CreatorRequests")
            .then(results => resolve(results))
            .catch(error => reject(error))
    });

    Ribc.postCreatorUpdate = (updates) => new Promise((resolve, reject) => {
        floCloudAPI.sendGeneralData(updates, "CreatorUpdates")
            .then(results => resolve(results))
            .catch(error => reject(error))
    });

    Ribc.getCreatorUpdates = function (count = null) {
        let creatorUpdates = Object.values(floGlobals.generalDataset("CreatorUpdates")).map(data => {
            return {
                floID: data.senderID,
                update: data.message,
                time: data.vectorClock.split('_')[0],
                note: data.note,
                tag: data.tag
            }
        })
        creatorUpdates = creatorUpdates.filter(data => data.floID in _.creatorList)
        creatorUpdates.reverse()
        if (count && count < creatorUpdates.length)
            creatorUpdates = creatorUpdates.slice(0, count)
        return creatorUpdates;
    }

    Admin.commentCreatorUpdate = (vectorClock, comment) => new Promise((resolve, reject) => {
        if (!(vectorClock in floGlobals.generalDataset("CreatorUpdates")))
            return reject("Creator update not found");
        floCloudAPI.noteApplicationData(vectorClock, comment)
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Ribc.applyForTask = (details) => new Promise((resolve, reject) => {
        floCloudAPI.sendGeneralData(details, "TaskRequests")
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Ribc.getProjectList = () => Object.keys(_.projectMap);
    Ribc.getProjectDetails = (project) => _.projectDetails[project];
    Ribc.getProjectMap = (project) => _.projectMap[project];
    Ribc.getProjectBranches = (project) => findAllBranches(project);
    Ribc.getTaskDetails = (taskId) => _.projectTaskDetails[taskId];
    Ribc.getTaskStatus = (taskId) => _.projectTaskStatus[taskId];
    Ribc.getCreatorList = () => _.creatorList;
    Ribc.getCreatorRating = (floID) => _.creatorRating[floID] || 0;
    Ribc.getCreatorRecord = (floID) => _.creatorRecord[floID] || {};
    Ribc.getAssignedCreators = (taskId) => _.creatorsAssigned[taskId] || [];
    Ribc.getAllTasks = () => _.projectTaskDetails
    Ribc.getDisplayedTasks = () => Array.isArray(floGlobals.appObjects.VideoMarketplace.displayedTasks) ? floGlobals.appObjects.VideoMarketplace.displayedTasks : [];

    Admin.updateObjects = () => new Promise((resolve, reject) => {
        floCloudAPI.updateObjectData("VideoMarketplace")
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Admin.resetObjects = () => new Promise((resolve, reject) => {
        floCloudAPI.resetObjectData("VideoMarketplace")
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Admin.addProjectDetails = function (projectCode, details) {
        if (!(projectCode in _.projectMap))
            return "Project not Found!";
        if (projectCode in _.projectDetails && typeof projectCode === 'object' && typeof details === 'object')
            for (let d in details)
                _.projectDetails[projectCode][d] = details[d];
        else
            _.projectDetails[projectCode] = details;
        return "added project details for " + projectCode;
    }

    Ribc.getCreatorRequests = function (ignoreProcessed = true) {
        var creatorRequests = Object.values(floGlobals.generalDataset("CreatorRequests")).map(data => {
            return {
                floID: data.senderID,
                vectorClock: data.vectorClock,
                details: data.message,
                status: data.note,
            }
        })
        //filter existing creators
        creatorRequests = creatorRequests.filter(data => !(data.floID in _.creatorList))
        //filter processed requests
        if (ignoreProcessed)
            creatorRequests = creatorRequests.filter(data => !data.status);
        return creatorRequests;
    }

        // Resolve per-creator task status by latest timestamp (assigned/completed/failed/reopened)
    Ribc.getLatestTaskStatus = function (floID, taskId) {
      const rec = Ribc.getCreatorRecord(floID) || {};
      const events = [];

      const assignedOn = rec.assignedTasks?.[taskId]?.assignedOn;
      if (assignedOn) events.push({ s: 'active', t: assignedOn });

      const compDate = rec.completedTasks?.[taskId]?.completionDate;
      if (compDate) events.push({ s: 'completed', t: compDate });

      const failDate = rec.failedTasks?.[taskId]?.failedDate;
      if (failDate) events.push({ s: 'failed', t: failDate });

      const reopenDate = rec.reopenedTasks?.[taskId]?.reopenedDate;
      if (reopenDate) events.push({ s: 'active', t: reopenDate });

      if (!events.length) return 'active';
      events.sort((a, b) => a.t - b.t);
      return events[events.length - 1].s; // latest wins
    }
    // Aggregate latest status across assigned creators
    Ribc.getAggregateTaskStatus = function (taskId) {
      const creatorIds = Ribc.getAssignedCreators(taskId) || [];
      if (!creatorIds.length) return Ribc.getTaskStatus(taskId) || 'active';

      const states = creatorIds.map(id => Ribc.getLatestTaskStatus(id, taskId)); // 'active'|'completed'|'failed'

      if (states.length && states.every(s => s === 'completed')) return 'completed';
      if (states.some(s => s === 'active')) return 'active';
      if (states.every(s => s === 'failed')) return 'failed';
      return 'mixed';
    };


    Admin.processCreatorRequest = function (vectorClock, accept = true) {
        let request = floGlobals.generalDataset("CreatorRequests")[vectorClock];
        if (!request)
            return "Request not found";
        var status;
        if (accept && addCreator(request.senderID, request.message[0]))
            status = "Accepted";
        else
            status = "Rejected";
        floCloudAPI.noteApplicationData(vectorClock, status).then(_ => null).catch(e => console.error(e))
        return status;
    }
    Admin.initCreatorRecord = function (floID) {
        if (!_.creatorRecord[floID])
            _.creatorRecord[floID] = {
                active: true,
                joined: Date.now(),
                assignedTasks: {},
                completedTasks: {},
                failedTasks: {},
            }
    }
    const addCreator = Admin.addCreator = function (floID, creatorName) {
        if (floID in _.creatorList)
            return false
        _.creatorList[floID] = creatorName
        _.creatorRating[floID] = 0
        Admin.initCreatorRecord(floID)
        return true;
    }
    Admin.renameCreator = function (floID, newName) {
        if (!(floID in _.creatorList))
            return false;
        _.creatorList[floID] = newName;
        return true;
    }

    Admin.removeCreator = function (floID) {
        if (!(floID in _.creatorList))
            return false
        delete _.creatorList[floID]
        delete _.creatorRating[floID]
        delete _.creatorRecord[floID]
        for (const taskKey in _.projectTaskDetails) {
            if (_.creatorsAssigned[taskKey].includes(floID))
                _.creatorsAssigned[taskKey] = _.creatorsAssigned[taskKey].filter(id => id !== floID)
        }
        return true;
    }
    Admin.addCompletedTask = function (floID, taskKey, points, details = {}) {
        if (!(floID in _.creatorList))
            return false;
        Admin.initCreatorRecord(floID)
        _.creatorRecord[floID].completedTasks[taskKey] = {
            points,
            ...details
        };
        // calculate rating
        let totalScore = 0;
        for (const taskKey in _.creatorRecord[floID].completedTasks) {
            totalScore += _.creatorRecord[floID].completedTasks[taskKey].points;
        }
        const completedTasks = Object.keys(_.creatorRecord[floID].completedTasks).length;
        const failedTasks = Object.keys(_.creatorRecord[floID].failedTasks).length;
        _.creatorRating[floID] = parseInt(totalScore / (completedTasks + failedTasks) || 1);
        return true;
    }


    // (existing) Append-only "reopened" stamp
    Admin.addReopenedTask = function (floID, taskKey, details = {}) {
      if (!(floID in _.creatorList)) return false;
      Admin.initCreatorRecord(floID);

      if (!_.creatorRecord[floID].reopenedTasks)
        _.creatorRecord[floID].reopenedTasks = {};

      const reopenedDate = details.reopenedDate || Date.now();
      _.creatorRecord[floID].reopenedTasks[taskKey] = { reopenedDate };
      return true;
    };

    // (new) Remove a completion entry when a task is made incomplete
    Admin.removeCompletedTask = function (floID, taskKey) {
      if (!(floID in _.creatorList)) return false;
      Admin.initCreatorRecord(floID);
      const rec = _.creatorRecord[floID];
      if (rec?.completedTasks && taskKey in rec.completedTasks) {
        delete rec.completedTasks[taskKey];
        return true;
      }
      return false;
    };

    // (existing) Recompute rating, ignoring completions superseded by later reopen
    Admin.recomputeRating = function (floID) {
      const rec = _.creatorRecord[floID];
      if (!rec) return;

      let totalScore = 0;
      let denom = 0;

      for (const key in (rec.completedTasks || {})) {
        const comp = rec.completedTasks[key];
        const compDate = comp.completionDate || 0;
        const reopenedDate = rec.reopenedTasks?.[key]?.reopenedDate || 0;
        if (reopenedDate > compDate) continue; // reopened later ⇒ ignore this completion
        totalScore += Number(comp.points) || 0;
        denom += 1;
      }

      // keep failed tasks in denominator (your current policy)
      denom += Object.keys(rec.failedTasks || {}).length;

      _.creatorRating[floID] = Math.floor(denom ? (totalScore / denom) : 1) || 1;
    };

    // (optional) One-shot reconciliation if you want extra safety
    Admin.syncCreatorRecordWithTaskStatus = function (taskId) {
      const getAssigned = RIBC.getAssignedCreators || RIBC.admin?.getAssignedCreators;
      const assignedCreators = (typeof getAssigned === 'function' ? getAssigned(taskId) : []) || [];
      const status = RIBC.getTaskStatus?.(taskId) || RIBC.getAggregateTaskStatus?.(taskId);
      if (!status) return;

      if (status === 'completed') {
        const completionDate = Date.now();
        assignedCreators.forEach(creatorId => {
          const rec = _.creatorRecord?.[creatorId];
          const has = !!(rec && rec.completedTasks && rec.completedTasks[taskId]);
          if (!has) RIBC.admin.addCompletedTask(creatorId, taskId, 0, { completionDate });
          RIBC.admin.recomputeRating?.(creatorId);
        });
      } else if (status === 'incomplete') {
        const reopenedDate = Date.now();
        assignedCreators.forEach(creatorId => {
          RIBC.admin.addReopenedTask(creatorId, taskId, { reopenedDate });
          RIBC.admin.removeCompletedTask?.(creatorId, taskId);
          RIBC.admin.recomputeRating?.(creatorId);
        });
      }
    };




    Admin.addFailedTask = function (floID, taskKey, details = {}) {
        if (!(floID in _.creatorList))
            return false;
        Admin.initCreatorRecord(floID)
        _.creatorRecord[floID].failedTasks[taskKey] = {
            ...details
        };
        Admin.unassignCreatorFromTask(floID, taskKey);
        return true;
    }
    Admin.setCreatorStatus = function (floID, active = true) {
        if (!(floID in _.creatorList))
            return false;
        _.creatorRecord[floID].active = active;
        return true;
    }
    Ribc.getTaskRequests = function (ignoreProcessed = true) {
        var taskRequests = Object.values(floGlobals.generalDataset("TaskRequests")).map(data => {
            return {
                floID: data.senderID,
                vectorClock: data.vectorClock,
                details: data.message,
                status: data.note
            }
        })
        // filter only requests for logged in creator
        try {
            if (floDapps.user.id && !floGlobals.subAdmins.includes(floDapps.user.id))
                taskRequests = taskRequests.filter(data => data.floID === floDapps.user.id)
        } catch (err) {
            return [];
        }
        //filter processed requests
        if (ignoreProcessed)
            taskRequests = taskRequests.filter(data => !data.status)
        return taskRequests
    }

    Admin.processTaskRequest = function (vectorClock, accept = true) {
        let request = floGlobals.generalDataset("TaskRequests")[vectorClock];
        if (!request)
            return "Request not found";
        const { message: { taskId, name }, senderID } = request;
        const [projectCode, branch, taskNumber] = taskId.split('_');
        var status;
        addCreator(senderID, name)
        if (accept && assignCreatorToTask(senderID, projectCode, branch, taskNumber))
            status = "Accepted";
        else
            status = "Rejected";
        return floCloudAPI.noteApplicationData(vectorClock, status)
    }

    const assignCreatorToTask = Admin.assignCreatorToTask = function (floID, projectCode, branch, taskNumber) {
        const key = projectCode + "_" + branch + "_" + taskNumber
        if (!_.creatorsAssigned[key])
            _.creatorsAssigned[key] = []
        if (!_.creatorsAssigned[key].includes(floID)) {
            _.creatorsAssigned[key].push(floID)
            _.creatorRecord[floID].assignedTasks[key] = { assignedOn: Date.now() }
            return true
        } else
            return false
    }

    Admin.unassignCreatorFromTask = function (floID, taskKey) {
        if (_.creatorsAssigned[taskKey] && _.creatorsAssigned[taskKey].includes(floID)) {
            _.creatorsAssigned[taskKey] = _.creatorsAssigned[taskKey].filter(id => id !== floID)
            delete _.creatorRecord[floID].assignedTasks[taskKey]
            return true
        } else
            return false
    }

    Admin.putTaskStatus = function (taskStatus, projectCode, branch, taskNumber) {
        _.projectTaskStatus[projectCode + "_" + branch + "_" + taskNumber] = taskStatus;
    };

    Admin.setDisplayedTasks = function (tasksArr = []) {
        floGlobals.appObjects.VideoMarketplace.displayedTasks = tasksArr;
    }

    Admin.createProject = function (projectCode) {
        if (projectCode in _.projectMap) {
            return "Project Name already exists";
        }
        addBranch(projectCode);
        return "Project Create: " + projectCode
    }

    Admin.copyBranchToNewProject = function (oldProjectCode, oldBranch, newProjectCode, newBranchConnection,
        newStartPoint, newEndPoint) {
        //Make sure new branch is a new text string that does not exist in new project
        if (oldBranch == "mainLine") {
            return "You cannot change mainLine";
        }
        if (_.projectMap.hasOwnProperty(newProjectCode) == false) {
            return "The project does not exist"
        }
        if (_.projectMap[newProjectCode].hasOwnProperty(newBranch) == false) {
            return "The branch does not exist"
        }
        if (newStartPoint > newEndPoint) {
            return "Startpoint cannot be later than endpoint"
        }

        var newBranch = addBranch(newProjectCode, newBranchConnection, newStartPoint, newEndPoint);
        _.projectMap[newProjectCode][newBranch] = _.projectMap[oldProjectCode][oldBranch].slice();


        if (newBranchConnection == "undefined") {
            _.projectMap[newProjectCode][newBranch][0] = "mainLine";
        } else {
            _.projectMap[newProjectCode][newBranch][0] = "newBranchConnection";
        }
        if (newStartPoint != "undefined") {
            _.projectMap[newProjectCode][newBranch][2] = newStartPoint;
        }
        if (newEndPoint != "undefined") {
            _.projectMap[newProjectCode][newBranch][3] = newEndPoint;
        }

        //Add entry in _.projectBranches.This may not be needed now
        //_.projectBranches[newProjectCode] = _.projectBranches[newProjectCode]+","+newBranch;

        //Copy Task List too
        var p = _.projectTaskDetails;
        for (var key in p) {
            if (p.hasOwnProperty(key)) {
                if (key.contains(oldProjectCode + "_" + oldBranch)) {
                    var numberExtract = key.replace(oldProjectCode + "_" + oldBranch + "_", "");
                    _.projectTaskDetails[newProjectCode + "_" + newBranch + "_" + numberExtract] = p[key];
                }
            }
        }
        return _.projectMap[newProjectCode][newBranch];
    }

    Admin.deleteTaskInMap = function (projectCode, branch, taskNumber) {
        var arr = _.projectMap[projectCode][branch];
        var currentIndex;
        for (var i = 4; i < arr.length; i++) {
            if (arr[i] == taskNumber) {
                currentIndex = i
            };
        }

        var nextIndex = currentIndex + 1,
            previousIndex = currentIndex - 1;
        var nextTaskNumber = _.projectMap[projectCode][branch][nextIndex],
            previousTaskNumber = _.projectMap[projectCode][branch][previousIndex];

        var deleteMode;
        if (currentIndex == (arr.length - 1)) {
            deleteMode = "last"
        };
        if (currentIndex == 4) {
            deleteMode = "first"
        };
        if ((currentIndex > 4) && (currentIndex < (arr.length - 1))) {
            deleteMode = "normal"
        };
        if ((currentIndex == 4) && (currentIndex == (arr.length - 1))) {
            deleteMode = "nothingToDelete"
        };

        //Checking for links elsewhere 
        var otherBranches = Object.keys(_.projectMap[projectCode]);
        //Remove the native branch and mainLine from otherBranches list
        // otherBranches.splice(otherBranches.indexOf(branch), 1);
        // otherBranches.splice(otherBranches.indexOf("mainLine"), 1);
        otherBranches = otherBranches.filter(currBranch => currBranch !== branch || currBranch !== "mainLine");

        //Checking the link other branches
        for (var i = 0; i < otherBranches.length; i++) {
            if (_.projectMap[projectCode][otherBranches[i]][2] == taskNumber) {
                if (deleteMode == "normal") {
                    _.projectMap[projectCode][otherBranches[i]][2] = previousTaskNumber
                } else if (deleteMode == "last") {
                    _.projectMap[projectCode][otherBranches[i]][2] = previousTaskNumber
                } else if (deleteMode == "first") {
                    _.projectMap[projectCode][otherBranches[i]][2] = nextTaskNumber
                } else if (deleteMode == "undefined") {
                    return " nothing to delete"
                }
            }
            if (_.projectMap[projectCode][otherBranches[i]][3] == taskNumber) {
                if (deleteMode == "normal") {
                    _.projectMap[projectCode][otherBranches[i]][3] = nextTaskNumber
                } else if (deleteMode == "last") {
                    _.projectMap[projectCode][otherBranches[i]][3] = previousTaskNumber
                } else if (deleteMode == "first") {
                    _.projectMap[projectCode][otherBranches[i]][3] = nextTaskNumber
                } else if (deleteMode == "undefined") {
                    return " nothing to delete"
                }
            }
        } //end for loop

        //Delete from other databases
        var p = _.projectTaskDetails;
        for (var key in p) {
            if (p.hasOwnProperty(key)) {
                if (key == projectCode + "_" + branch + "_" + taskNumber) {
                    delete p[key]
                }
            }
        } // end function
        //Now splice the element
        arr.splice(currentIndex, 1);
        arr[1] = arr[1] - 1;
    }

    Admin.insertTaskInMap = function (projectCode, branchName, insertPoint) {
        var lastTasks = [];
        lastTasks = findLastTaskNumber(projectCode);
        var lastNumber = lastTasks[branchName];
        var arr = _.projectMap[projectCode][branchName];
        var addedTaskNumber = lastNumber + 1;
        var insertIndex = 0;

        //Find insert point index
        for (var i = 4; i < arr.length; i++) {
            if (arr[i] >= addedTaskNumber) {
                addedTaskNumber = arr[i] + 1
            }
            if (arr[i] == insertPoint) {
                insertIndex = i;
            }
        }

        if (insertIndex > 3) {
            arr.splice((insertIndex + 1), 0, addedTaskNumber);
            arr[1]++;
        } else {
            return "Not possible to insert here.Try another position"
        }

        return addedTaskNumber;
    }


    //The best error management I have done
    //Project changing is overdoing right now
    //newStartPoint,newEndPoint is optional
    Admin.changeBranchLine = function (projectCode, branch, newConnection, newStartPoint, newEndPoint) {
        //find the task number on the original line where it was branched, and then close the line there
        //Do some basic tests
        if (branch == "mainLine") {
            return "You cannot change mainLine";
        }
        if (_.projectMap.hasOwnProperty(projectCode) == false) {
            return "The project does not exist"
        }
        if (_.projectMap[projectCode].hasOwnProperty(branch) == false) {
            return "The branch does not exist"
        }
        if (_.projectMap[projectCode].hasOwnProperty(newConnection) == false) {
            return "The newConnection does not exist"
        }
        if (newStartPoint > newEndPoint) {
            return "Startpoint cannot be later than endpoint"
        }

        _.projectMap[projectCode][branch][0] = newConnection;
        if (newStartPoint != "undefined") {
            _.projectMap[projectCode][branch][2] = newStartPoint;
        }
        if (newEndPoint != "undefined") {
            _.projectMap[projectCode][branch][3] = newEndPoint;
        }

        return _.projectMap[projectCode][branch];
    }

    //startOrEndOrNewProject 1=>Start,2=>End .. projectCode and branch will remain same .. mainLines cannot be rerouted
    //One test is missing .. you cannot connect to a point after end of connected trunk .. do it later .. not critical  
    Admin.changeBranchPoint = function (projectCode, branch, newPoint, startOrEnd) {
        var message;

        if (branch != "mainLine") {
            if (startOrEnd == 1) {
                if (newPoint <= _.projectMap[projectCode][branch][3]) {
                    _.projectMap[projectCode][branch][2] = newPoint;
                    message = newPoint;
                } else {
                    message = "Start point cannot be later than end point"
                }
            }
            if (startOrEnd == 2) {
                if (newPoint >= _.projectMap[projectCode][branch][2]) {
                    _.projectMap[projectCode][branch][3] = newPoint;
                    message = newPoint;
                } else {
                    message = "End point cannot be earlier than start point"
                }
            }
        }
        if (branch == "mainLine") {
            message = "mainLine cannot be rerouted"
        }
        return message;
    }

    const addBranch = Admin.addBranch = function (projectCode1, branch, startPoint, mergePoint) {
        var arr = findAllBranches(projectCode1);
        var newBranchName;

        if (arr == false) {
            _.projectMap[projectCode1] = {};
            _.projectMap[projectCode1]["mainLine"] = ["mainLine", 0, "Start", "Stop"];
            newBranchName = "mainLine";
            _.projectBranches[projectCode1] = "mainLine";
            //projectCode[projectCode.length] = projectCode1;
        } else {
            var str = arr[arr.length - 1];

            if (str.includes("branch")) {
                var res = str.split("branch");
                var newNumber = parseFloat(res[1]) + 1;
                newBranchName = "branch" + newNumber;
                _.projectMap[projectCode1]["branch" + newNumber] = [branch, 0, startPoint, mergePoint];
                _.projectBranches[projectCode1] = _.projectBranches[projectCode1] + "," + "branch" +
                    newNumber;
            }

            if (str.includes("mainLine")) {
                newBranchName = "branch1";
                _.projectMap[projectCode1]["branch1"] = ["mainLine", 0, startPoint, mergePoint];
                _.projectBranches[projectCode1] = "mainLine,branch1";
            }
        }
        return newBranchName;
    }

    Admin.editTaskDetails = function (taskDetails, projectCode, branch, taskNumber) {
        //add taskDetails
        _.projectTaskDetails[projectCode + "_" + branch + "_" + taskNumber] = { ..._.projectTaskDetails[projectCode + "_" + branch + "_" + taskNumber], ...taskDetails };
    }

    Admin.addTaskInMap = function (projectCode, branchName) {
        var lastTasks = [];
        lastTasks = findLastTaskNumber(projectCode);
        var lastNumber = lastTasks[branchName];

        var addedTaskNumber = lastNumber + 1;
        _.projectMap[projectCode][branchName].push(addedTaskNumber);
        _.projectMap[projectCode][branchName][1]++;

        return addedTaskNumber
    }

    function findAllBranches(projectCode) {
        if (_.projectBranches.hasOwnProperty(projectCode)) {
            var branch = _.projectBranches[projectCode].split(",");
        } else branch = false;

        return branch;
    }

    function findLastTaskNumber(projectCode) {
        var returnData = {};
        //Find all branch lines
        var branch = _.projectBranches[projectCode].split(",");
        for (var i = 0; i < branch.length; i++) {
            returnData[branch[i]] = _.projectMap[projectCode][branch[i]][1];
            //This test seems to have become redundant
            if (returnData[branch[i]] == "Stop") {
                returnData[branch[i]] = 0
            }
        }
        return returnData;
    }

})();
