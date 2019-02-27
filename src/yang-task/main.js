const vscode = require('vscode');
const path = require('path');
const fse = require('fs-extra');
const OptionsProvider = require('../../lib/options-provider');

var tp;
const tasks_json = {
  "version": "2.0.0",
  "tasks": [
    {
      "label": "alios-studio: Make",
      "type": "shell",
      "command": "aos",
      "args": [
        "make",
        "helloworld@starterkit"
      ],
      "presentation": {
        "panel": "dedicated"
      }
    },
    {
      "label": "alios-studio: Upload",
      "type": "shell",
      "command": "aos",
      "args": [
        "upload",
        "helloworld@starterkit"
      ],
      "presentation": {
        "panel": "dedicated"
      }
    },
    {
      "label": "alios-studio: Serial Monitor",
      "type": "shell",
      "command": "aos",
      "args": [
        "monitor"
      ],
      "presentation": {
        "panel": "dedicated"
      }
    },
    {
      "label": "alios-studio: List Devices",
      "type": "shell",
      "command": "aos",
      "args": [
        "devices"
      ],
      "presentation": {
        "panel": "dedicated"
      }
    },
    {
      "label": "alios-studio: Clean",
      "type": "shell",
      "command": "aos",
      "args": [
        "make",
        "clean"
      ],
      "presentation": {
        "panel": "dedicated"
      }
    }
  ]
};

module.exports = class AOSTasksProvider {

  constructor(root) {
    this.config = OptionsProvider.getInstance();
    // FIXME check if in aos project or aos source
    if (vscode.workspace.rootPath &&
        (this.config.isAosSource ||
         fse.pathExistsSync(path.join(vscode.workspace.rootPath, '.aos')))) {
      vscode.window
      .showInformationMessage('Welcome to AliOS Studio! Take a tutorial?', 'Yes', 'Later')
      .then(answer => {
        if (answer == 'Yes') {
          vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://github.com/alibaba/AliOS-Things/wiki/AliOS-Things-Studio'));
        }
      })
      const tasksFile = path.join(root, '.vscode', 'tasks.json');
      if (fse.pathExistsSync(tasksFile)) {
        this.updateTasks(root);
      } else {
        this.generateTasks(root);
      }
    }
  }

  static getInstance(root) {
    if (!tp) {
        tp = new AOSTasksProvider(root);
    }
    return tp;
  }

  generateTasks(root) {
    if (!root) {
      console.warn('not a vscode project');
      return;
    }
    const tasksFile = path.join(root, '.vscode', 'tasks.json');
    let obj = tasks_json;
    try {
      fse.writeJsonSync(tasksFile, obj, {spaces: 2});
    } catch (err) {
      console.error(err);
      vscode.window.showErrorMessage(err.toString());
    };
  }

  taskItemExist(itemLabel, tasks) {
    return tasks.some(t => {
      return (t.label === itemLabel);
    });
  }
  
  validateTasks(obj) {
    if (obj.hasOwnProperty("tasks") && obj.hasOwnProperty("version")) {
      tasks_json.tasks.forEach(t => {
        if (!this.taskItemExist(t.label, obj.tasks)) {
          obj.tasks.push(t);
        }
      });
    } else {
      obj = tasks_json;
    }
    return obj;
  }

  async updateTasks(root) {
    if (!root) {
      console.warn('not a vscode project');
      return;
    }
    const tasksFile = path.join(root, '.vscode', 'tasks.json');
    //console.log(tasksFile);
    let obj = {};
    try {
      obj = fse.readJsonSync(tasksFile);
    } catch (err) {
      console.error(err);
      vscode.window.showErrorMessage(err.toString());
      return err;
    }

    obj = this.validateTasks(obj);

    //console.dir(obj);
    obj.tasks.forEach(t => {
      switch (t.label) {
        case 'alios-studio: Make':
          t.args[1] = this.config.name + '@' + this.config.board;
          break;
        case 'alios-studio: Upload':
          t.args[1] = this.config.name + '@' + this.config.board;
          break;
        case 'alios-studio: Serial Monitor':
          if (!this.config.comPort) {
            t.args[1] = '';
          } else {
            t.args[1] = this.config.comPort;
          }
          if (!this.config.baudrate) {
            t.args[2] = '';
          } else {
            t.args[2] = this.config.baudrate.toString();
          }
          break;
          case 'alios-studio: List Devices':
          break;
          case 'alios-studio: Clean':
          break;
        default:
          console.dir(t.label, t.args);
          break;
      }
    });
    //console.dir(obj);
    try {
      fse.writeJsonSync(tasksFile, obj, {spaces: 2});
    } catch (err) {
      console.error(err);
      vscode.window.showErrorMessage(err.toString());
    }
  }
};