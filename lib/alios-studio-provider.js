// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

const OptionsProvider = require('./options-provider');
const config = OptionsProvider.getInstance();

class AliosStudioProvider {

    constructor() {

    }

    initialize() {
    }

    provideTextDocumentContent(uri) {
        //console.log(uri);
        let res = `${uri.scheme}://${uri.authority}${uri.path}?${uri.query}`.match(/aliosstudio:\/\/(.*)/)[1] || 'index';
        //console.log(res)
        console.log(`http://127.0.0.1:${config.serverPort}/${res}`);
        return `
        <!DOCTYPE html>
        <html>
            <head><meta charset="utf-8"></head>
            <body style="margin: 0; padding: 0; height: 100%; overflow: hidden;">
                <iframe src="" id="frame" width="100%" height="100%" frameborder="0" style="position:absolute; left: 0; right: 0; bottom: 0; top: 0px;"></iframe>
            </body>
            <script type="text/javascript">
                let url = "http://127.0.0.1:${config.serverPort}/${res}",
                    styleSheet = window.getComputedStyle(document.documentElement),
                    bgColor = styleSheet.getPropertyValue('--background-color').trim() || '#1e1e1e',
                    color = styleSheet.getPropertyValue('--color').trim() || '#d4d4d4',
                    theme = document.body.className || 'vscode-dark';
                document.getElementById('frame').src = url + (~url.indexOf('?') ? '&' : '?') + 'theme=' + theme + '&bgcolor=' + encodeURIComponent(bgColor) + '&color=' + encodeURIComponent(color);
            </script>
        </html>`;
    }

}

module.exports = new AliosStudioProvider();
