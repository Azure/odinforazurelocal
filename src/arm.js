(function () {
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function highlightJson(jsonText) {
        // Minimal JSON highlighter (no external deps).
        // Produces HTML with spans. Assumes `jsonText` is already pretty-printed.
        var s = String(jsonText || '');
        var out = '';
        var i = 0;

        function isWs(ch) { return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'; }
        function peekNonWs(start) {
            for (var j = start; j < s.length; j++) {
                var c = s[j];
                if (!isWs(c)) return c;
            }
            return '';
        }

        while (i < s.length) {
            var ch = s[i];

            // Whitespace
            if (isWs(ch)) {
                out += ch;
                i++;
                continue;
            }

            // Strings
            if (ch === '"') {
                var start = i;
                i++; // consume opening quote
                var escaped = false;
                while (i < s.length) {
                    var c2 = s[i];
                    if (escaped) {
                        escaped = false;
                        i++;
                        continue;
                    }
                    if (c2 === '\\') {
                        escaped = true;
                        i++;
                        continue;
                    }
                    if (c2 === '"') {
                        i++; // consume closing quote
                        break;
                    }
                    i++;
                }

                var strToken = s.slice(start, i);
                var next = peekNonWs(i);
                var cls = (next === ':') ? 'json-token--key' : 'json-token--string';
                out += '<span class="' + cls + '">' + escapeHtml(strToken) + '</span>';
                continue;
            }

            // Numbers
            if (ch === '-' || (ch >= '0' && ch <= '9')) {
                var numMatch = s.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+\-]?\d+)?/);
                if (numMatch && numMatch[0]) {
                    var numTok = numMatch[0];
                    out += '<span class="json-token--number">' + escapeHtml(numTok) + '</span>';
                    i += numTok.length;
                    continue;
                }
            }

            // Literals
            if (s.slice(i, i + 4) === 'true') {
                out += '<span class="json-token--boolean">true</span>';
                i += 4;
                continue;
            }
            if (s.slice(i, i + 5) === 'false') {
                out += '<span class="json-token--boolean">false</span>';
                i += 5;
                continue;
            }
            if (s.slice(i, i + 4) === 'null') {
                out += '<span class="json-token--null">null</span>';
                i += 4;
                continue;
            }

            // Punctuation / fallback
            out += '<span class="json-token--punct">' + escapeHtml(ch) + '</span>';
            i++;
        }

        return out;
    }

    function tryParsePayload() {
        // 1) URL hash payload (preferred for file:// reliability)
        try {
            var hash = window.location.hash || '';
            var idx = hash.indexOf('data=');
            if (idx >= 0) {
                var encoded = hash.substring(idx + 5);
                encoded = decodeURIComponent(encoded);
                var json = decodeURIComponent(escape(atob(encoded)));
                return JSON.parse(json);
            }
        } catch (e) {
            // ignore
        }

        // 2) localStorage fallback
        try {
            var raw = localStorage.getItem('azloc_arm_payload');
            if (raw) return JSON.parse(raw);
        } catch (e2) {
            // ignore
        }

        return null;
    }

    function setMeta(metaEl, payload) {
        if (!metaEl) return;
        if (!payload) {
            metaEl.innerHTML = '<div style="color:var(--text-secondary);">No payload found. Generate ARM parameters from the wizard first.</div>';
            return;
        }

        var generatedAt = payload.generatedAt ? String(payload.generatedAt) : '';
        var version = payload.version ? String(payload.version) : '';
        var cloud = payload.cloud ? String(payload.cloud) : '';
        var ref = payload.referenceTemplate || null;
        var refName = ref && ref.name ? String(ref.name) : '';
        var refUrl = ref && ref.url ? String(ref.url) : '';

        function formatCloud(s) {
            if (s === 'azure_government') return 'Azure Government';
            if (s === 'azure_commercial') return 'Azure Commercial';
            if (s === 'azure_china') return 'Azure China';
            return s || '';
        }

        metaEl.innerHTML = ''
            + '<div style="display:flex; flex-direction:column; gap:0.35rem;">'
            + '<div><strong>Generated:</strong> <span style="color:var(--text-secondary);">' + escapeHtml(generatedAt || '-') + '</span></div>'
            + '<div><strong>Format:</strong> <span style="color:var(--text-secondary);">Azure deploymentParameters.json</span></div>'
            + (cloud ? ('<div><strong>Azure Cloud:</strong> <span style="color:var(--text-secondary);">' + escapeHtml(formatCloud(cloud)) + '</span></div>') : '')
            + (refUrl ? ('<div><strong>Reference template:</strong> <a href="' + escapeHtml(refUrl) + '" target="_blank" rel="noopener" style="color:var(--accent-blue);">' + escapeHtml(refName || refUrl) + '</a></div>') : '')
            + (version ? ('<div><strong>Wizard version:</strong> <span style="color:var(--text-secondary);">' + escapeHtml(version) + '</span></div>') : '')
            + '</div>';
    }

    function setPlaceholders(placeholdersEl, placeholders) {
        if (!placeholdersEl) return;

        var list = Array.isArray(placeholders) ? placeholders : [];
        if (list.length === 0) {
            placeholdersEl.innerHTML = '<div class="info-box visible">No placeholders reported.</div>';
            return;
        }

        placeholdersEl.innerHTML = ''
            + '<div class="info-box visible">'
            + '<strong>These values are placeholders:</strong>'
            + '<ul style="margin:0.5rem 0 0 1.1rem; color:var(--text-secondary);">'
            + list.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join('')
            + '</ul>'
            + '</div>';
    }

    function attachCopy(copyBtn, statusEl, getText) {
        if (!copyBtn || !getText) return;

        function setStatus(msg) {
            if (!statusEl) return;
            statusEl.textContent = msg || '';
        }

        copyBtn.addEventListener('click', async function () {
            try {
                var text = String(getText() || '');
                if (!text) {
                    setStatus('Nothing to copy.');
                    return;
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    setStatus('Copied to clipboard.');
                    return;
                }

                // Fallback
                var tmp = document.createElement('textarea');
                tmp.value = text;
                tmp.setAttribute('readonly', 'readonly');
                tmp.style.position = 'fixed';
                tmp.style.left = '-9999px';
                tmp.style.top = '0';
                document.body.appendChild(tmp);
                tmp.focus();
                tmp.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(tmp);
                setStatus(ok ? 'Copied to clipboard.' : 'Copy failed.');
            } catch (e) {
                setStatus('Copy failed.');
            }
        });
    }

    function main() {
        var payload = tryParsePayload();

        var metaEl = document.getElementById('arm-meta');
        var placeholdersEl = document.getElementById('arm-placeholders');
        var codeEl = document.getElementById('arm-json-code');
        var copyBtn = document.getElementById('arm-copy-btn');
        var statusEl = document.getElementById('arm-copy-status');

        setMeta(metaEl, payload);

        if (!payload || !payload.parametersFile) {
            if (placeholdersEl) placeholdersEl.innerHTML = '<div class="info-box visible">No data to display.</div>';
            if (codeEl) codeEl.textContent = '';
            if (copyBtn) copyBtn.disabled = true;
            return;
        }

        var readiness = payload.readiness || {};
        setPlaceholders(placeholdersEl, readiness.placeholders);

        var rawJsonText = '';
        try {
            rawJsonText = JSON.stringify(payload.parametersFile, null, 2);
        } catch (e2) {
            rawJsonText = String(payload.parametersFile);
        }

        if (codeEl) codeEl.innerHTML = highlightJson(rawJsonText);

        if (copyBtn) copyBtn.disabled = false;
        attachCopy(copyBtn, statusEl, function () { return rawJsonText; });
    }

    main();
})();
