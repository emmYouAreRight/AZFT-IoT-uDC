'use strict'

const childProcess = require('child_process')

// with modifications based on https://www.npmjs.com/package/shell-exec
function execCommand(cmd = '', opts = {}) {
  if (Array.isArray(cmd)) {
    cmd = cmd.join(';')
  }

  let child

  try {
    child = childProcess.spawn(cmd, opts)
  } catch (error) {
    return Promise.reject(error)
  }

  return new Promise(resolve => {
    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', data => {
        stdout += data
      })
    }

    if (child.stderr) {
      child.stderr.on('data', data => {
        stderr += data
      })
    }

    child.on('error', error => {
      resolve({ error, stdout, stderr, cmd })
    })

    child.on('close', code => {
      resolve({ stdout, stderr, cmd, code })
    })
  })
}

module.exports.execCommand = execCommand