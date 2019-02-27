void function() {
    if (location.search) {
        let array = location.search.replace('?', '').split('&'),
            parameters = {};
        array.forEach(item => {
            item = item.split('=');
            parameters[item[0]] = decodeURIComponent(item[1]);
        });
        //
        function getStyleSheet(title) {
            let styleSheets = document.styleSheets;
            for(let i = 0; i < styleSheets.length; i++) {
                if (styleSheets[i].title !== title) {continue;}
                return styleSheets[i];
            }
        }
        function getCssRule(sheet, selector, styleProp) {
            let rules = sheet.rules;
            for(let i = 0; i < rules.length; i++) {
                // console.log(rules[i].selectorText);
                if (!rules[i].selectorText
                    || !rules[i].style
                    || (selector instanceof RegExp ? !rules[i].selectorText.match(selector) : !~rules[i].selectorText.indexOf(selector))
                    || !rules[i].style[styleProp]) {continue;}
                return rules[i];
            }
        }
        let sheet = getStyleSheet('semantic'),
            body = getCssRule(sheet, 'body', 'backgroundColor');
        //
        sheet.addRule('.theme-bgcolor', `background-color: ${parameters.bgcolor}`);
        sheet.addRule('.theme-color', `color: ${parameters.color}`);
        //
        body.style.backgroundColor = parameters.bgcolor;
        body.style.color =
        getCssRule(sheet, '.ui.form .inline.field > label', 'color').style.color =
        getCssRule(sheet, '.ui.list > .item .description', 'color').style.color =

        getCssRule(sheet, '.ui.toggle.checkbox input:checked ~ label', 'color').style.color =
        getCssRule(sheet, /^\.ui\.checkbox\sinput:focus\s~\slabel$/, 'color').style.color =
        getCssRule(sheet, '.ui.toggle.checkbox input:focus:checked ~ label', 'color').style.color =
        getCssRule(sheet, '.ui.toggle.checkbox label', 'color').style.color =
        getCssRule(sheet, '.ui.tabular.menu .item', 'color').style.color =
        getCssRule(sheet, '.ui.tabular.menu .item:hover', 'color').style.color =
        getCssRule(sheet, '.ui.form .field > label', 'color').style.color = parameters.color;
        //
        getCssRule(sheet, '.ui.card > .content,', 'margin').style.color =
        getCssRule(sheet, '.ui.modal > .content', 'display').style.color = 'rgba(0,0,0,.87)';
    }
}();
