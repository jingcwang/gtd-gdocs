// This is a google app scripts that implements a GTD work flow using
// Google Docs.
//
// Author: Jing Conan Wang
// Email: jingconanwang@gmail.com
//
// This code is under GPL license.

// FIXME need to factor the script.js to several smaller files

GTD.initSummaryTable = function() {
  var taskTable = GTD.Summary.searchTaskSummaryTable();
  if (taskTable === null) {
    taskTable = GTD.Summary.createSummaryTable(GTD.body);
    if (taskTable === null || (typeof taskTable === 'undefined')) {
      return false;
    }
  }

  GTD.taskTable = taskTable;
  return true;
};

/* Get the task under cursor
 */
GTD.getSelectedTask = function(type) {
    var ret = {};
    var taskHeaderResult = GTD.Task.getTaskThreadHeader();
    var taskHeader = taskHeaderResult.header;
    if (!taskHeader) {
        ret.status = 'NO_TASK_FOUND';
        return ret;
    }
    if (!GTD.Task.isValidTaskThreadHeader(taskHeader)) {
        ret.status = 'INVALID_TASK_THREAD_HEADER';
        return ret;
    }
    var statusBefore = GTD.Task.getThreadHeaderStatus(taskHeader);
    var taskDesc = GTD.Task.getTaskDesc(taskHeader);
    if (!taskDesc) {
        ret.status = 'NO_VALID_TASK_NAME'
        return ret;
    }
    ret.taskDesc = taskDesc;
    ret.threadHeader = taskHeader;
    ret.statusBefore = statusBefore;
    ret.cursorStatus = taskHeaderResult.status;
    ret.status = 'SUCCESS';
    return ret;
};

/**
 * changeTaskStatus
 *
 * @param {object} options.task object
 * @param {string} options.task.taskDesc task description
 * @param {boolean} options.disableGTask indicate whether GTask service
 *     needs to be updated
 * @param {string} options.status {'Actionable'|'Waiting
 *     For'|'Done'|'SomDay'}, a string that represents the status
 */
GTD.changeTaskStatus = function(options) {
    var task = options.task;

    // Update Summary table
    GTD.Summary.cleanTask('All', task);
    GTD.Summary.addTask(options.status, task);

    // Update Task thread header
    GTD.Task.setThreadHeaderStatus(task.threadHeader, options.status);
};

/**
 * Insert task and update information in summary table
 *
 * @param {Text} Google docs Text element for which the task will be created.
 * @param {string} status status of task
 * @returns {object} task object
 */
GTD.insertTask = function(ele, status) {
    var task = GTD.Task.createNewTask(ele, status);
    if (task === null || (typeof task === 'undefined')) {
        return;
    }

    if (GTD.initialize() !== true) {
      return;
    }

    // Update task's status in summary table.
    GTD.changeTaskStatus({
        task: task,
        status: status
    });

    return task;
};

GTD.insertComment = function() {
    GTD.Task.insertComment();
};

GTD.initialize = function() { 
  if (GTD.initialized === true) {
    return true;
  }

  // Set background of document to be solarized light color
  var style = {};
  var doc = DocumentApp.getActiveDocument().getBody();
  doc.setAttributes(style);

  // symbolStatusMap is a mapping from a symbol to the actual
  // status. In the task thread, we only use symbol to indicate
  // task staus, this map will be used to do lookup to get
  // the actual status.
  GTD.symbolStatusMap = {};
  for (var key in GTD.statusSymbol) {
    if (GTD.statusSymbol.hasOwnProperty(key)) {
      GTD.symbolStatusMap[GTD.statusSymbol[key]] = key;
    }
  }


  if (GTD.initSummaryTable() === false) {
    return false;
  }
  GTD.initialized = true;
  return true;
};

GTD.searchBookmarkIdBasedOnTaskDesc = function(taskDesc) {
    var doc = DocumentApp.getActiveDocument();
    var bookmarks = doc.getBookmarks();
    var i, header, desc;
    for (i = 0; i < bookmarks.length; ++i) {
        header = GTD.Task.getTaskThreadHeader(bookmarks[i].getPosition().getElement()).header;
        if (!GTD.Task.isValidTaskThreadHeader(header)) {
            continue;
        }
        desc = GTD.Task.getTaskDesc(header);
        if (taskDesc === desc) {
            return bookmarks[i].getId();
        }
    }
};

/* Get position of thread header for a task
 * Returns Position if the position can be found, and undfined
 * otherwise.
 */
GTD.getTaskThreadPosition = function(task) {
    var doc = DocumentApp.getActiveDocument();
    var documentProperties = PropertiesService.getDocumentProperties();
    var bookmarkId = documentProperties.getProperty(task.taskDesc);
    if (!bookmarkId) {
        Logger.log('PropertiesService unsynced!');
        bookmarkId =  GTD.searchBookmarkIdBasedOnTaskDesc(task.taskDesc);
        if (bookmarkId) {
            documentProperties.setProperty(task.taskDesc, bookmarkId);
        } else {
            return;
        }
    }
    var bookmark = doc.getBookmark(bookmarkId);

    if (bookmark) {
        return bookmark.getPosition();
    }
};


GTD.changeTaskStatusMenuWrapper = function(options) {
    if (GTD.initialize() !== true) {
      return;
    }
    var statusAfter = options.statusAfter;
    var ret = GTD.getSelectedTask(statusAfter);
    if (ret.status !== 'SUCCESS') {
        DocumentApp.getUi().alert('Cannot find a valid task under cursor. ' +
                                  'Please put cursor in a task in summary table ' +
                                  'or thread header');
        return;
    }
    GTD.changeTaskStatus({task: ret, status: statusAfter});

    // if cursor was in summary table before the change, move the cursor
    // back to the summary table
    if (ret.cursorStatus === 'cursor_in_summary_table') {
        var doc = DocumentApp.getActiveDocument();
        var position = doc.newPosition(GTD.Summary.getSummaryTable(), 0);
        doc.setCursor(position);
    }
};
