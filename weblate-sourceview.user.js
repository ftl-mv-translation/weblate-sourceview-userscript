// ==UserScript==
// @name           Weblate SourceView
// @description    Attach source view alongside the translation page
// @author         nedsociety
// @include        /^https?://weblate.hyperq.be/translate/.*$/
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @grant          GM_getResourceText
// @resource       HLJS_CSS https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.1/styles/default.min.css
// @require        https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.1/highlight.min.js
// @version        1.00
// ==/UserScript==

(() => {
    var doc = (typeof (unsafeWindow) !== "undefined" ? unsafeWindow : window).document;
    var body = doc.body;

    getXml = (url, callback) => {
        var key = `WEBLATE_SOURCEVIEW_USERSCRIPT_${url}`
        var value = sessionStorage.getItem(key);
        if (value !== null) {
            console.log(`Loaded ${url} from sessionStorage.`);
            callback(value);
        }
        else {
            console.log(`${url} is missing; fetching...`);
            GM_xmlhttpRequest({
                method: "GET",
                url,
                onload: (response) => {
                    if (response.status === 200) {
                        var value = response.responseText;
                        sessionStorage.setItem(key, value);
                        callback(value);
                    } else {
                        console.log(`fetching ${url} failed: status ${response.status}`);
                    }
                }
            });
        }
    }

    var escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    var main = () => {
        var fileName = null;
        var lineNo = null;

        var GITHUB_SOURCE_BROWSER_PREFIX = "https://github.com/ftl-mv-translation/ftl-mv-translation/blob/main/";
        var GITHUB_RAW_PREFIX = "https://raw.githubusercontent.com/ftl-mv-translation/ftl-mv-translation/main/";

        var regexSourceBrowser = new RegExp(escapeRegExp(GITHUB_SOURCE_BROWSER_PREFIX) + "(.*)#L([0-9]+)");

        [...document.querySelectorAll('.string-info a')].every((e) => {
            var match = e.href.match(regexSourceBrowser);
            if (match) {
                fileName = GITHUB_RAW_PREFIX + match[1];
                lineNo = parseInt(match[2]);
                return false;
            }
            return true;
        });

        if (fileName === null || lineNo === null) {
            return;
        }

        var initPanel = () => {

            body.style.cssText = "width: 60%;";

            var panelElement = doc.createElement("div");
            panelElement.style.cssText = "position: fixed; width: 40%; height: 100vh; right: 0; top:0; display: block; background: #115; overflow: auto;";
            var preElement = doc.createElement("pre");
            preElement.style.cssText = "height: 100%; margin-bottom: 0px";
            var codeElement = doc.createElement("code");
            codeElement.className = "language-xml"
            codeElement.style.cssText = "font-size: 9pt; white-space: pre; height: 100%;";

            body.appendChild(panelElement);
            panelElement.appendChild(preElement);
            preElement.appendChild(codeElement);

            return { preElement, codeElement };
        }
        var { preElement, codeElement } = initPanel();

        getXml(fileName,
            (code) => {
                var lines = code.split("\n");
                var lineBegin = Math.max(lineNo - 100, 0);
                var lineEnd = Math.min(lineNo + 100, lines.length);
                var lines = lines.slice(lineBegin, lineEnd);

                codeElement.appendChild(doc.createTextNode(lines.join("\n")));
                hljs.highlightElement(codeElement);

                var highlightLine = () => {
                    lineRowElement = codeElement.querySelector(`td[data-line-number="${lineNo}"]`);
                    if (lineRowElement) {
                        // Highlight the line
                        lineRowElement.parentElement.style.backgroundColor = "#aa2";

                        // Scroll to the line
                        if (lineEnd - lineBegin > 0) {
                            requestAnimationFrame(() => {
                                var scrollValue = codeElement.scrollHeight * (lineNo - lineBegin) / (lineEnd - lineBegin) - codeElement.clientHeight / 2;
                                codeElement.scrollTop = scrollValue;
                            });
                        }
                    }
                };

                // Workaround: lineNumbersBlock() is asynchronous (via setTimeout) internally.
                //             Make it run highlightLine() when done, by hooking setTimeout.
                var _st = window.setTimeout;
                window.setTimeout = (f, t) => {
                    _st(() => {
                        f();
                        _st(highlightLine, 0);
                    }, t);
                };
                hljs.lineNumbersBlock(codeElement, { startFrom: lineBegin + 1 });
                window.setTimeout = _st;
            }
        );
    }

    (() => {
        // Add highlight.js CSS
        var cssText = GM_getResourceText("HLJS_CSS");
        GM_addStyle(cssText);
        // There's no padding between line numbers and contents so let's space them a bit.
        GM_addStyle(".hljs-ln-numbers {padding-right: 1em !important;}");

        // Workaround: highlightjs-line-numbers need window.hljs set before import
        window.hljs = hljs;
        // The next line is identical to: https://cdnjs.cloudflare.com/ajax/libs/highlightjs-line-numbers.js/2.8.0/highlightjs-line-numbers.min.js
        !function (r, o) { "use strict"; var e, i = "hljs-ln", l = "hljs-ln-line", h = "hljs-ln-code", s = "hljs-ln-numbers", c = "hljs-ln-n", m = "data-line-number", a = /\r\n|\r|\n/g; function u(e) { for (var n = e.toString(), t = e.anchorNode; "TD" !== t.nodeName;)t = t.parentNode; for (var r = e.focusNode; "TD" !== r.nodeName;)r = r.parentNode; var o = parseInt(t.dataset.lineNumber), a = parseInt(r.dataset.lineNumber); if (o == a) return n; var i, l = t.textContent, s = r.textContent; for (a < o && (i = o, o = a, a = i, i = l, l = s, s = i); 0 !== n.indexOf(l);)l = l.slice(1); for (; -1 === n.lastIndexOf(s);)s = s.slice(0, -1); for (var c = l, u = function (e) { for (var n = e; "TABLE" !== n.nodeName;)n = n.parentNode; return n }(t), d = o + 1; d < a; ++d) { var f = p('.{0}[{1}="{2}"]', [h, m, d]); c += "\n" + u.querySelector(f).textContent } return c += "\n" + s } function n(e) { try { var n = o.querySelectorAll("code.hljs,code.nohighlight"); for (var t in n) n.hasOwnProperty(t) && (n[t].classList.contains("nohljsln") || d(n[t], e)) } catch (e) { r.console.error("LineNumbers error: ", e) } } function d(e, n) { "object" == typeof e && r.setTimeout(function () { e.innerHTML = f(e, n) }, 0) } function f(e, n) { var t, r, o = (t = e, { singleLine: function (e) { return !!e.singleLine && e.singleLine }(r = (r = n) || {}), startFrom: function (e, n) { var t = 1; isFinite(n.startFrom) && (t = n.startFrom); var r = function (e, n) { return e.hasAttribute(n) ? e.getAttribute(n) : null }(e, "data-ln-start-from"); return null !== r && (t = function (e, n) { if (!e) return n; var t = Number(e); return isFinite(t) ? t : n }(r, 1)), t }(t, r) }); return function e(n) { var t = n.childNodes; for (var r in t) { var o; t.hasOwnProperty(r) && (o = t[r], 0 < (o.textContent.trim().match(a) || []).length && (0 < o.childNodes.length ? e(o) : v(o.parentNode))) } }(e), function (e, n) { var t = g(e); "" === t[t.length - 1].trim() && t.pop(); if (1 < t.length || n.singleLine) { for (var r = "", o = 0, a = t.length; o < a; o++)r += p('<tr><td class="{0} {1}" {3}="{5}"><div class="{2}" {3}="{5}"></div></td><td class="{0} {4}" {3}="{5}">{6}</td></tr>', [l, s, c, m, h, o + n.startFrom, 0 < t[o].length ? t[o] : " "]); return p('<table class="{0}">{1}</table>', [i, r]) } return e }(e.innerHTML, o) } function v(e) { var n = e.className; if (/hljs-/.test(n)) { for (var t = g(e.innerHTML), r = 0, o = ""; r < t.length; r++) { o += p('<span class="{0}">{1}</span>\n', [n, 0 < t[r].length ? t[r] : " "]) } e.innerHTML = o.trim() } } function g(e) { return 0 === e.length ? [] : e.split(a) } function p(e, t) { return e.replace(/\{(\d+)\}/g, function (e, n) { return void 0 !== t[n] ? t[n] : e }) } r.hljs ? (r.hljs.initLineNumbersOnLoad = function (e) { "interactive" === o.readyState || "complete" === o.readyState ? n(e) : r.addEventListener("DOMContentLoaded", function () { n(e) }) }, r.hljs.lineNumbersBlock = d, r.hljs.lineNumbersValue = function (e, n) { if ("string" != typeof e) return; var t = document.createElement("code"); return t.innerHTML = e, f(t, n) }, (e = o.createElement("style")).type = "text/css", e.innerHTML = p(".{0}{border-collapse:collapse}.{0} td{padding:0}.{1}:before{content:attr({2})}", [i, c, m]), o.getElementsByTagName("head")[0].appendChild(e)) : r.console.error("highlight.js not detected!"), document.addEventListener("copy", function (e) { var n, t = window.getSelection(); !function (e) { for (var n = e; n;) { if (n.className && -1 !== n.className.indexOf("hljs-ln-code")) return 1; n = n.parentNode } }(t.anchorNode) || (n = -1 !== window.navigator.userAgent.indexOf("Edge") ? u(t) : t.toString(), e.clipboardData.setData("text/plain", n), e.preventDefault()) }) }(window, document);
    })();

    main();
})();
