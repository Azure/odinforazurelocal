/* ODIN — PowerPoint export for the Configuration Report (template-based)
 *
 * Loads OdinPPTTemplate.potx, strips its example slides, and injects one slide
 * per section in SECTION_PLAN below. Each plan entry matches one or more
 * scraped .summary-section blocks from the rendered report; rows on the matched
 * blocks become bullets and the first diagram (if any) becomes the slide picture.
 *
 * Template layouts used:
 *   layout1  "Title and Subtitle"   — cover
 *   layout9  "Title and 2 column"   — text-only section slides
 *   layout10 "Title and 2 column"   — section slides with a picture on the right
 *   layout14 "Closing"              — final slide
 *
 * Public API:
 *   window.downloadReportPptx(themeName)   // themeName ignored (template owns theme)
 *
 * Depends on JSZip, which is exposed on window by report/vendor/pptxgen.bundle.js.
 */
(function () {
    window.downloadReportPptx = downloadReportPptx;

    var TEMPLATE_URL = 'template/OdinPPTTemplate.potx';

    var TEMPLATE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml';
    var PRES_CT     = 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
    var SLIDE_CT    = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
    var SLIDE_REL   = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
    var LAYOUT_REL    = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout';
    var IMAGE_REL     = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
    var HYPERLINK_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

    // ---------- Slide plan ----------
    //
    // One entry per content slide. `match` is a list of case-insensitive title
    // prefixes; any scraped block whose title starts with one of them contributes
    // its rows + diagrams to this slide. Slides whose plan has zero matching rows
    // AND zero diagrams are skipped.
    //
    // `requireDisagg: true` skips the slide entirely when the configuration is
    // hyperconverged (the Disaggregated VRF section doesn't exist there).
    var SECTION_PLAN = [
        {
            title: 'Deployment Scenario & Scale',
            match: ['Scenario & Scale', 'Deployment Scenario', 'Scale & Nodes', 'Storage & Ports'],
            customExtract: extractScenarioScale
        },
        {
            title: 'Physical Network Configuration',
            match: [],
            // Pin the slide picture to the rack diagram (R2 of the report) so the
            // physical layout is what readers see, not a connectivity diagram.
            useRackDiagram: true,
            // Build the bullet list from report state (racks, nodes, switches,
            // SAN fabrics) instead of scraping section rows — the matching
            // sections don't expose those numbers as label/value pairs.
            customExtract: extractPhysicalTopology
        },
        {
            title: 'Node Configuration',
            match: [
                'Rack Aware TOR Architecture',
                'Hardware Configuration'
            ]
        },
        {
            // Sizer-only slide: per-workload breakdown (VM / AKS / AVD).
            // Skipped automatically when no `sizerWorkloads` data is present
            // (i.e. the report wasn't started from the Sizer).
            title: 'Workloads',
            match: [],
            customExtract: extractSizerWorkloads
        },
        {
            title: 'Leaf & Spine Architecture',
            // The disaggregated report renders the leaf-spine fabric requirements
            // as a multi-row category table (no .summary-row pairs), so we use
            // a custom extractor to surface architecture facts — not VRF detail,
            // which lives on the next slide.
            match: ['Leaf & Spine Fabric Requirements'],
            diagramSrcMatch: 'firewall-load-balancer-network-controller-service-leafs',
            requireDisagg: true,
            customExtract: extractLeafSpineArchitecture
        },
        {
            // VRF follow-up slide: AKS LNET routing-hop scenarios + the matching
            // Single-VRF / Separate-VRF reachability diagram. The content lives
            // inside the Leaf & Spine Fabric Requirements block (no standalone
            // section), so we extract it via a custom DOM scrape.
            title: 'AKS Logical Network Reachability & Routing Hops',
            match: [],
            requireDisagg: true,
            customExtract: extractAksReachability
        },
        {
            title: 'Host Networking, Intents & Overrides',
            match: [
                'Host Networking',
                'Disaggregated Host Networking',
                'Traffic Intent'
            ],
            customExtract: extractHostNetworking
        },
        {
            title: 'Outbound Connectivity',
            match: ['Outbound, Arc, Proxy']
        },
        {
            // Proxy configuration follow-up slide: outbound/arc/proxy state +
            // the rendered "Minimum Proxy Bypass String" + planning notes.
            title: 'Proxy Configuration',
            match: [],
            customExtract: extractProxyConfiguration
        },
        {
            // Private Endpoints follow-up slide: one bullet per selected PE
            // service (name + FQDN), scraped from the rendered Outbound block.
            title: 'Private Endpoints',
            match: [],
            customExtract: extractPrivateEndpoints
        },
        {
            title: 'Nodes Network Configuration',
            // Per-node networking lives in the host networking diagram (no separate
            // section exists today) — pick that up if no IP-table block is found.
            match: ['AKS Arc Network', 'Disaggregated Host Networking', 'Network Connectivity', 'Switched Connectivity']
        },
        {
            title: 'Infrastructure Network Configuration',
            match: ['Infrastructure Network', 'IP, Infrastructure Network'],
            customExtract: extractInfraNetwork
        },
        {
            title: 'Active Directory Configuration',
            match: ['Active Directory', 'Identity & DNS']
        },
        {
            title: 'Security Configuration',
            match: ['Security Configuration', 'Security '],
            customExtract: extractSecurityConfiguration
        }
    ];

    // ---------- Generic helpers ----------

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function nowStamp() {
        var d = new Date();
        function pad(n) { return n < 10 ? '0' + n : '' + n; }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + '_' + pad(d.getHours()) + pad(d.getMinutes());
    }

    function plainText(el) {
        if (!el) return '';
        return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function escXml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function titleMatches(title, pattern) {
        if (!title) return false;
        var t = title.toLowerCase().trim();
        var p = pattern.toLowerCase().trim();
        return t === p || t.indexOf(p) === 0;
    }

    // ---------- Scraping (read content from the rendered report) ----------

    function scrapeMeta() {
        var el = $('#report-meta');
        if (!el) return [];
        var pairs = [];
        var label = null;
        var buf = '';
        function flush() {
            if (label !== null) pairs.push({ label: label, value: buf.trim() });
            label = null; buf = '';
        }
        for (var i = 0; i < el.childNodes.length; i++) {
            var n = el.childNodes[i];
            if (n.nodeType === 1 && n.tagName === 'STRONG') {
                flush();
                label = (n.textContent || '').trim();
            } else if (n.nodeType === 1 && n.tagName === 'BR') {
                /* skip */
            } else {
                buf += (n.textContent || '');
            }
        }
        flush();
        return pairs.filter(function (p) { return p.label && p.value; });
    }

    // Section icons / badges are tiny inline SVGs; we only want real diagrams.
    // Anything narrower than this in CSS pixels is treated as decoration and skipped.
    var DIAGRAM_MIN_WIDTH_PX = 240;

    function svgRenderedWidth(svg) {
        if (!svg) return 0;
        try {
            var r = svg.getBoundingClientRect();
            if (r && r.width) return r.width;
        } catch (e) { /* ignore */ }
        var w = parseFloat(svg.getAttribute('width') || '0');
        if (w) return w;
        var vb = (svg.getAttribute('viewBox') || '').split(/\s+/);
        return vb.length === 4 ? parseFloat(vb[2]) || 0 : 0;
    }

    // Fallback bullet harvest for sections that don't use .summary-row pairs:
    // we walk <li> items and short <strong>label:</strong> value paragraphs.
    function harvestFallbackBullets(sec) {
        var out = [];
        var lis = $$('li', sec);
        lis.forEach(function (li) {
            // Skip nested <li> children of an outer <li> we'll already capture.
            if (li.parentElement && li.parentElement.closest('li')) return;
            var t = plainText(li);
            if (t && t.length <= 220) out.push(t);
        });
        if (out.length === 0) {
            // Look for simple <strong>Label:</strong> rest paragraphs.
            $$('p, div', sec).forEach(function (p) {
                var s = p.querySelector(':scope > strong');
                if (!s) return;
                var label = plainText(s).replace(/[:\s]+$/, '');
                var rest = plainText(p).slice(plainText(s).length).replace(/^[:\s]+/, '');
                if (label && rest && rest.length <= 220) out.push(label + ': ' + rest);
            });
        }
        // Dedupe while preserving order.
        var seen = Object.create(null);
        return out.filter(function (x) {
            var k = x.toLowerCase();
            if (seen[k]) return false;
            seen[k] = true;
            return true;
        });
    }

    function scrapeBlocks() {
        var nodes = $$('#report-summary .summary-section, #report-rationale .summary-section');
        return nodes.map(function (sec) {
            var titleEl = sec.querySelector('.summary-section-title');
            var title = plainText(titleEl) || 'Section';
            var rows = $$('.summary-row', sec).map(function (row) {
                return {
                    label: plainText(row.querySelector('.summary-label')),
                    value: plainText(row.querySelector('.summary-value'))
                };
            }).filter(function (r) { return r.label && r.value; });
            var svgs = $$('svg', sec).filter(function (s) {
                return svgRenderedWidth(s) >= DIAGRAM_MIN_WIDTH_PX;
            });
            var imgs = $$('img', sec).map(function (img) {
                var src = img.getAttribute('src') || '';
                if (!/\.svg(\?|$)/i.test(src)) return null;
                return { src: src, alt: img.getAttribute('alt') || '' };
            }).filter(Boolean);
            var fallback = (rows.length === 0) ? harvestFallbackBullets(sec) : [];
            return { title: title, rows: rows, svgs: svgs, imgs: imgs, fallback: fallback };
        });
    }

    // ---------- Diagram rasterization ----------

    function pngFromDataUrl(dataUrl) {
        if (!dataUrl) return null;
        var i = dataUrl.indexOf(',');
        return (i >= 0) ? dataUrl.substring(i + 1) : null;
    }

    // Match the report's dark "card" surface so rasterized diagrams keep the
    // contrast they have on screen instead of rendering on a transparent (white-
    // appearing in PowerPoint) background.
    var DIAGRAM_BG = '#0b1220';

    function rasterizeSvgEl(svgEl) {
        if (!svgEl || typeof window.__odinSvgElementToPng !== 'function') return Promise.resolve(null);
        return window.__odinSvgElementToPng(svgEl, { theme: 'dark', background: DIAGRAM_BG, scale: 2 })
            .then(function (dataUrl) { return pngWithAspect(dataUrl); })
            .catch(function () { return null; });
    }

    function rasterizeSvgUrl(url) {
        if (!url) return Promise.resolve(null);
        return fetch(url, { credentials: 'omit', cache: 'force-cache' })
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (txt) {
                if (!txt) return null;
                try {
                    var doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
                    var svg = doc && doc.documentElement;
                    if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;
                    return rasterizeSvgEl(svg);
                } catch (e) {
                    return null;
                }
            })
            .catch(function () { return null; });
    }

    // Rasterize an SVG document supplied as a literal XML string. Used for
    // dynamically generated diagrams (e.g. the infra subnet utilisation bar).
    function rasterizeSvgString(svgStr) {
        if (!svgStr) return Promise.resolve(null);
        try {
            var doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml');
            var svg = doc && doc.documentElement;
            if (!svg || svg.nodeName.toLowerCase() !== 'svg') return Promise.resolve(null);
            return rasterizeSvgEl(svg);
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    // Resolves a data-URL PNG to { png: base64, aspect: width/height } so the
    // caller can emit a floating picture sized to preserve the natural aspect.
    function pngWithAspect(dataUrl) {
        var b64 = pngFromDataUrl(dataUrl);
        if (!b64) return null;
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                var aspect = (img.naturalHeight > 0)
                    ? (img.naturalWidth / img.naturalHeight)
                    : 1;
                resolve({ png: b64, aspect: aspect });
            };
            img.onerror = function () { resolve({ png: b64, aspect: 1 }); };
            img.src = dataUrl;
        });
    }

    // ---------- OOXML emitters ----------

    function paragraphXml(text, lvl, sz, runs) {
        // Tight bullets: zero space before/after each paragraph and 100% line spacing,
        // so rows hug each other (matches the compact list style requested).
        var pPrInner = '<a:lnSpc><a:spcPct val="100000"/></a:lnSpc>'
            + '<a:spcBef><a:spcPts val="0"/></a:spcBef>'
            + '<a:spcAft><a:spcPts val="0"/></a:spcAft>';
        var lvlAttr = (lvl != null) ? ' lvl="' + lvl + '"' : '';
        var pPr = '<a:pPr' + lvlAttr + '>' + pPrInner + '</a:pPr>';
        function runXml(t, color, linkRid) {
            var szAttr = sz ? ' sz="' + sz + '"' : '';
            var fill = color ? '<a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill>' : '';
            var hlink = (linkRid != null) ? '<a:hlinkClick xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId' + linkRid + '"/>' : '';
            return '<a:r><a:rPr lang="en-US"' + szAttr + ' dirty="0">' + fill + hlink + '</a:rPr>'
                + '<a:t>' + escXml(t) + '</a:t></a:r>';
        }
        var body;
        if (Array.isArray(runs) && runs.length) {
            body = runs.map(function (r) { return runXml(r.text, r.color, r.linkRid); }).join('');
        } else {
            body = runXml(text);
        }
        return '<a:p>' + pPr + body + '</a:p>';
    }

    function placeholderSp(spId, name, phType, phIdx, content, sz, xfrm) {
        var typeAttr = phType ? ' type="' + phType + '"' : '';
        var idxAttr  = (phIdx != null) ? ' idx="' + phIdx + '"' : '';
        var paras;
        if (Array.isArray(content)) {
            paras = content.map(function (c) {
                if (c && typeof c === 'object') return paragraphXml(c.text, c.lvl, sz, c.runs);
                return paragraphXml(c, null, sz);
            }).join('');
        } else {
            paras = paragraphXml(content || '', null, sz);
        }
        var spPr = '<p:spPr/>';
        if (xfrm) {
            spPr = '<p:spPr>' +
                '<a:xfrm><a:off x="' + xfrm.x + '" y="' + xfrm.y + '"/>' +
                '<a:ext cx="' + xfrm.cx + '" cy="' + xfrm.cy + '"/></a:xfrm>' +
                '</p:spPr>';
        }
        return '<p:sp>' +
            '<p:nvSpPr>' +
                '<p:cNvPr id="' + spId + '" name="' + escXml(name) + '"/>' +
                '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
                '<p:nvPr><p:ph' + typeAttr + idxAttr + '/></p:nvPr>' +
            '</p:nvSpPr>' +
            spPr +
            '<p:txBody><a:bodyPr/><a:lstStyle/>' + paras + '</p:txBody>' +
            '</p:sp>';
    }

    function placeholderSpSized(spId, name, phType, phIdx, text, sz) {
        var typeAttr = phType ? ' type="' + phType + '"' : '';
        var idxAttr  = (phIdx != null) ? ' idx="' + phIdx + '"' : '';
        return '<p:sp>' +
            '<p:nvSpPr>' +
                '<p:cNvPr id="' + spId + '" name="' + escXml(name) + '"/>' +
                '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
                '<p:nvPr><p:ph' + typeAttr + idxAttr + '/></p:nvPr>' +
            '</p:nvSpPr>' +
            '<p:spPr/>' +
            '<p:txBody><a:bodyPr/><a:lstStyle/>' +
                '<a:p>' +
                    '<a:r><a:rPr lang="en-US" sz="' + sz + '" dirty="0"/>' +
                        '<a:t>' + escXml(text) + '</a:t></a:r>' +
                '</a:p>' +
            '</p:txBody>' +
            '</p:sp>';
    }

    function floatingPic(spId, name, imageRid, x, y, cx, cy) {
        return '<p:pic>' +
            '<p:nvPicPr>' +
                '<p:cNvPr id="' + spId + '" name="' + escXml(name) + '"/>' +
                '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>' +
                '<p:nvPr/>' +
            '</p:nvPicPr>' +
            '<p:blipFill>' +
                '<a:blip r:embed="rId' + imageRid + '"/>' +
                '<a:stretch><a:fillRect/></a:stretch>' +
            '</p:blipFill>' +
            '<p:spPr>' +
                '<a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
                '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
            '</p:spPr>' +
            '</p:pic>';
    }

    // Floating callout shape: a filled rounded rectangle with centered bold
    // text. Used for warning/info banners (e.g. Arc Private Link not
    // supported on Azure Local).
    function floatingCallout(spId, name, x, y, cx, cy, fillHex, text, textHex, sz) {
        var size = sz || 1400;
        return '<p:sp>' +
            '<p:nvSpPr>' +
                '<p:cNvPr id="' + spId + '" name="' + escXml(name) + '"/>' +
                '<p:cNvSpPr/>' +
                '<p:nvPr/>' +
            '</p:nvSpPr>' +
            '<p:spPr>' +
                '<a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
                '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 16667"/></a:avLst></a:prstGeom>' +
                '<a:solidFill><a:srgbClr val="' + fillHex + '"/></a:solidFill>' +
                '<a:ln w="12700"><a:solidFill><a:srgbClr val="' + fillHex + '"/></a:solidFill></a:ln>' +
            '</p:spPr>' +
            '<p:txBody>' +
                '<a:bodyPr anchor="ctr" wrap="square" lIns="91440" rIns="91440" tIns="45720" bIns="45720"/>' +
                '<a:lstStyle/>' +
                '<a:p>' +
                    '<a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>' +
                    '<a:r><a:rPr lang="en-US" sz="' + size + '" b="1" dirty="0">' +
                        '<a:solidFill><a:srgbClr val="' + textHex + '"/></a:solidFill>' +
                    '</a:rPr><a:t>' + escXml(text) + '</a:t></a:r>' +
                '</a:p>' +
            '</p:txBody>' +
            '</p:sp>';
    }

    function slideXml(spBlocks) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
            '<p:cSld><p:spTree>' +
                '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
                '<p:grpSpPr/>' +
                spBlocks.join('') +
            '</p:spTree></p:cSld>' +
            '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
            '</p:sld>';
    }

    function slideRels(layoutNum, images, links) {
        var rels = '<Relationship Id="rId1" Type="' + LAYOUT_REL +
            '" Target="../slideLayouts/slideLayout' + layoutNum + '.xml"/>';
        (images || []).forEach(function (img) {
            rels += '<Relationship Id="rId' + img.rid + '" Type="' + IMAGE_REL +
                '" Target="../media/' + img.target + '"/>';
        });
        (links || []).forEach(function (lk) {
            rels += '<Relationship Id="rId' + lk.rid + '" Type="' + HYPERLINK_REL +
                '" Target="' + escXml(lk.url) + '" TargetMode="External"/>';
        });
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            rels + '</Relationships>';
    }

    // ---------- High-level slide builders ----------

    function buildCoverSlide(meta, logoPng) {
        var customer = '';
        for (var i = 0; i < meta.length; i++) {
            if (/customer|organi[sz]ation|company/i.test(meta[i].label)) {
                customer = meta[i].value; break;
            }
        }
        var subtitle = customer
            ? customer
            : 'Azure Local Configuration Report — generated ' + nowStamp().replace('_', ' ');
        var sps = [
            placeholderSpSized(2, 'Title 1',    'title',    null, 'Azure Local Configuration', 4400),
            placeholderSpSized(3, 'Subtitle 2', 'subTitle', '1',  subtitle, 2000)
        ];
        var images = [];
        if (logoPng) {
            var cx = 1005840, cy = 1005840;          // 1.1" × 1.1"
            var x  = 12192000 - cx - 274320;          // 0.3" right margin (16:9 EMU width)
            var y  = 274320;                          // 0.3" top margin
            sps.push(floatingPic(10, 'ODIN Logo', 2, x, y, cx, cy));
            images.push({ rid: 2, target: 'logo.png', png: logoPng });
        }
        return { layout: 1, sps: sps, images: images };
    }

    function buildClosingSlide() {
        return {
            layout: 14,
            sps: [
                placeholderSp(2, 'Title 1', 'title', null, 'Thank you'),
                placeholderSp(3, 'Content Placeholder 6', null, '14',
                    'Generated by ODIN for Azure Local — https://azure.github.io/odinforazurelocal/')
            ]
        };
    }

    // Aggregates rows from every block matching `plan.match` and dedupes by
    // "label = value". Returns at most 14 bullets (a layout9/10 column reads
    // comfortably up to ~14 single-line items at the template's body font).
    function collectSectionRows(plan, blocks) {
        var seen = Object.create(null);
        var bullets = [];
        var sources = [];
        blocks.forEach(function (b) {
            var hit = plan.match.some(function (p) { return titleMatches(b.title, p); });
            if (!hit) return;
            sources.push(b.title);
            b.rows.forEach(function (r) {
                var key = (r.label + '\u0000' + r.value).toLowerCase();
                if (seen[key]) return;
                seen[key] = true;
                var value = summarizeNodeIpList(r.label, r.value);
                bullets.push({ text: r.label + ': ' + value, lvl: 1 });
            });
            (b.fallback || []).forEach(function (text) {
                var key = text.toLowerCase();
                if (seen[key]) return;
                seen[key] = true;
                bullets.push({ text: text, lvl: 1 });
            });
        });
        return { bullets: bullets.slice(0, 14), sources: sources };
    }

    // For very large clusters the rendered "Node IPs" row prints all N
    // node-name → IP pairs on one line, which blows past the bullet width
    // budget. When we detect that pattern with more than 16 entries, fold
    // contiguous IP runs into ranges (e.g.
    //   node1: 10.0.0.10, node2: 10.0.0.11 ... node64: 10.0.0.73
    // becomes
    //   64 nodes — node1–node64 → 10.0.0.10–10.0.0.73).
    function summarizeNodeIpList(label, value) {
        if (!/Node IPs/i.test(label) || !value) return value;
        var parts = value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (parts.length <= 16) return value;
        var entries = [];
        for (var i = 0; i < parts.length; i++) {
            var m = parts[i].match(/^(.+?):\s*(\d+\.\d+\.\d+\.\d+)$/);
            if (!m) return value; // unrecognised format — leave untouched
            entries.push({ name: m[1].trim(), ip: m[2] });
        }
        // Group runs whose IPs increment by 1 (in the last octet within the
        // same /24).
        function ipToInt(ip) {
            var o = ip.split('.').map(Number);
            return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
        }
        var runs = [];
        var run = { first: entries[0], last: entries[0], count: 1 };
        for (var k = 1; k < entries.length; k++) {
            if (ipToInt(entries[k].ip) === ipToInt(run.last.ip) + 1) {
                run.last = entries[k];
                run.count += 1;
            } else {
                runs.push(run);
                run = { first: entries[k], last: entries[k], count: 1 };
            }
        }
        runs.push(run);
        var summary = entries.length + ' nodes — ';
        summary += runs.map(function (r) {
            if (r.count === 1) return r.first.name + ': ' + r.first.ip;
            return r.first.name + '–' + r.last.name + ' → ' + r.first.ip + '–' + r.last.ip + ' (' + r.count + ')';
        }).join('; ');
        return summary;
    }

    // First diagram (svg element or image src) found across matching blocks.
    // If `plan.diagramSrcMatch` is set, prefer the first <img> whose src contains
    // that substring — used to pin a specific diagram when a section has several.
    function firstSectionDiagram(plan, blocks) {
        if (plan.useRackDiagram) {
            var rack = document.querySelector('#rack-diagram-container svg');
            if (rack) return { svgEl: rack, title: 'Rack Diagram' };
        }
        if (plan.diagramSrcMatch) {
            for (var j = 0; j < blocks.length; j++) {
                var bj = blocks[j];
                var hitJ = plan.match.some(function (p) { return titleMatches(bj.title, p); });
                if (!hitJ) continue;
                var pick = (bj.imgs || []).find(function (img) {
                    return img.src && img.src.indexOf(plan.diagramSrcMatch) !== -1;
                });
                if (pick) return { src: pick.src, title: bj.title };
            }
        }
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            var hit = plan.match.some(function (p) { return titleMatches(b.title, p); });
            if (!hit) continue;
            if (b.svgs && b.svgs.length) return { svgEl: b.svgs[0], title: b.title };
            if (b.imgs && b.imgs.length) return { src: b.imgs[0].src, title: b.title };
        }
        return null;
    }

    // Text-only section slide (layout9). No diagram → drop the sources
    // column entirely and let the bullets span the full slide width below
    // the title divider.
    // Slide canvas: 12192000 x 6858000 EMU.
    function buildTextSectionSlide(plan, content) {
        var sz = content.bulletSz || 1200;
        var sps = [
            placeholderSp(2, 'Title 1', 'title', null, plan.title),
            placeholderSp(4, 'Bullets', null,    '36',
                content.bullets.length ? content.bullets : [{ text: '—', lvl: 1 }], sz,
                BULLETS_XFRM_LAYOUT9)
        ];
        if (Array.isArray(content.extraSps)) sps = sps.concat(content.extraSps);
        return { layout: 9, sps: sps, links: content.links || [] };
    }

    // Section slide WITH a diagram (layout10). Right column = bullets,
    // left area = floating picture sized to fit the layout's picture region
    // while preserving the rasterized image's natural aspect ratio.
    //
    // Layout10 picture placeholder bounds (idx=37) in EMU:
    //   x=336550 y=336550 cx=5303640 cy=6184900
    var LAYOUT10_PIC_X  = 336550;
    var LAYOUT10_PIC_Y  = 336550;
    var LAYOUT10_PIC_CX = 5303640;
    var LAYOUT10_PIC_CY = 6184900;

    // Right-hand body placeholder geometry overrides. The default layout
    // boxes are too narrow and visually centered, leaving large empty space
    // on the right edge of the slide. We push the text closer to the diagram
    // / sources column and extend the box to within ~250k EMU of the slide
    // edge so longer bullets wrap less aggressively.
    // Slide canvas: 12192000 x 6858000 EMU. Diagram (layout10) ends at
    // 336550 + 5303640 = 5640190.
    var BULLETS_XFRM_LAYOUT10 = {
        x: 5800000, y: 2900000,
        cx: 6150000, cy: 3700000
    };
    // Layout9 (no diagram) — bullets span the full slide width below the
    // title divider since there's no sources column to share space with.
    var BULLETS_XFRM_LAYOUT9 = {
        x: 846000, y: 2900000,
        cx: 10500000, cy: 3700000
    };

    function buildPictureSectionSlide(plan, content, raster) {
        var imgRid = 2;
        var aspect = (raster && raster.aspect) || 1;

        // Fit (cx, cy) inside the placeholder while preserving aspect.
        var maxCx = LAYOUT10_PIC_CX;
        var maxCy = LAYOUT10_PIC_CY;
        var fitCx = maxCx;
        var fitCy = Math.round(fitCx / aspect);
        if (fitCy > maxCy) {
            fitCy = maxCy;
            fitCx = Math.round(fitCy * aspect);
        }
        var offX = LAYOUT10_PIC_X + Math.round((maxCx - fitCx) / 2);
        var offY = LAYOUT10_PIC_Y + Math.round((maxCy - fitCy) / 2);

        return {
            layout: 10,
            sps: [
                placeholderSp(2, 'Title 1', 'title', null, plan.title),
                floatingPic(3, 'Section Diagram', imgRid, offX, offY, fitCx, fitCy),
                placeholderSp(4, 'Content Placeholder 4', null, '36',
                    content.bullets.length ? content.bullets : [{ text: '—', lvl: 1 }], (content.bulletSz || 1200),
                    BULLETS_XFRM_LAYOUT10)
            ],
            images: [{ rid: imgRid, target: 'image.png', png: raster.png }],
            links: content.links || []
        };
    }

    function rasterizeDiagram(d) {
        if (!d) return Promise.resolve(null);
        if (d.svgEl) return rasterizeSvgEl(d.svgEl);
        if (d.src)   return rasterizeSvgUrl(d.src);
        return Promise.resolve(null);
    }

    // Layout9 variant with bullets on top half and a wide diagram pinned to
    // the bottom of the slide. Bullets get a shorter cy so they don't clash
    // with the picture. Used for the Infrastructure Network slide where the
    // subnet utilisation bar is the most important visual.
    function buildBulletsWithFooterSlide(plan, content, raster) {
        var imgRid = 2;
        // Bullet box: span the same width as the layout9 default but start
        // higher than the no-footer variant (the footer image needs vertical
        // room) and end well above the footer image.
        var bulletsXfrm = {
            x: BULLETS_XFRM_LAYOUT9.x,
            y: 2200000,
            cx: BULLETS_XFRM_LAYOUT9.cx,
            cy: 2700000
        };
        // Footer pic: full-width, ~1.6 inches tall, pinned ~0.2 in above
        // the slide bottom (slide height = 6,858,000).
        var footCx = BULLETS_XFRM_LAYOUT9.cx;
        var footCy = 1450000;
        var footX  = BULLETS_XFRM_LAYOUT9.x;
        var footY  = 6858000 - footCy - 200000;

        // Honour the source SVG aspect — letterbox horizontally if needed.
        if (raster && raster.aspect) {
            var idealCy = Math.round(footCx / raster.aspect);
            if (idealCy <= footCy) {
                footCy = idealCy;
                footY = 6858000 - footCy - 200000;
            } else {
                var idealCx = Math.round(footCy * raster.aspect);
                footX = footX + Math.round((footCx - idealCx) / 2);
                footCx = idealCx;
            }
        }

        var sps = [
            placeholderSp(2, 'Title 1', 'title', null, plan.title),
            placeholderSp(4, 'Bullets', null, '36',
                content.bullets.length ? content.bullets : [{ text: '\u2014', lvl: 1 }],
                1200, bulletsXfrm)
        ];
        var images = [];
        if (raster && raster.png) {
            sps.push(floatingPic(5, 'Footer Diagram', imgRid, footX, footY, footCx, footCy));
            images.push({ rid: imgRid, target: 'image.png', png: raster.png });
        }
        return { layout: 9, sps: sps, images: images };
    }

    // Layout9 variant — title at top + a single full-width SVG covering the
    // entire content area below the divider. Used for slides where the
    // content is visually rich (card grids, infographics).
    function buildBodySvgSlide(plan, raster) {
        var imgRid = 2;
        // Available area below title divider: y≈1,900,000 down to ~6,600,000
        // (slide is 6,858,000 tall). Width spans the bullets layout9 box.
        var maxX = BULLETS_XFRM_LAYOUT9.x;
        var maxCx = BULLETS_XFRM_LAYOUT9.cx;
        var maxY = 1900000;
        var maxCy = 4700000;
        var x = maxX, y = maxY, cx = maxCx, cy = maxCy;
        if (raster && raster.aspect) {
            // Letterbox to preserve aspect inside the available area.
            var fitCy = Math.round(cx / raster.aspect);
            if (fitCy <= maxCy) {
                cy = fitCy;
                y = maxY + Math.round((maxCy - cy) / 2);
            } else {
                cy = maxCy;
                cx = Math.round(cy * raster.aspect);
                x = maxX + Math.round((maxCx - cx) / 2);
            }
        }
        var sps = [
            placeholderSp(2, 'Title 1', 'title', null, plan.title)
        ];
        var images = [];
        if (raster && raster.png) {
            sps.push(floatingPic(5, 'Body Diagram', imgRid, x, y, cx, cy));
            images.push({ rid: imgRid, target: 'image.png', png: raster.png });
        }
        return { layout: 9, sps: sps, images: images };
    }

    function buildSectionSlide(plan, blocks, isDisagg) {
        if (plan.requireDisagg && !isDisagg) return Promise.resolve(null);

        if (typeof plan.customExtract === 'function') {
            var extracted = plan.customExtract(blocks, isDisagg);
            if (!extracted) return Promise.resolve(null);
            var ec = {
                bullets: (extracted.bullets || []).slice(0, 24),
                sources: extracted.sources || [],
                extraSps: extracted.extraSps || [],
                bulletSz: extracted.bulletSz || null,
                links: extracted.links || []
            };
            // Footer SVG: a custom bottom-of-slide diagram (used by the
            // Infrastructure Network slide for the subnet utilisation bar).
            if (extracted.footerSvgString) {
                return rasterizeSvgString(extracted.footerSvgString).then(function (raster) {
                    return buildBulletsWithFooterSlide(plan, ec, raster);
                });
            }
            // Body SVG: full-width SVG renders the entire content area (no
            // bullet box). Used by the Scenario & Scale card grid.
            if (extracted.bodySvgString) {
                return rasterizeSvgString(extracted.bodySvgString).then(function (raster) {
                    return buildBodySvgSlide(plan, raster);
                });
            }
            // Diagram resolution: explicit src from extractor wins; otherwise fall
            // back to the standard plan-driven picker (useRackDiagram, match-based).
            var customDiagram = firstSectionDiagram(plan, blocks);
            if (!ec.bullets.length && !extracted.diagramSrc && !customDiagram) {
                return Promise.resolve(null);
            }
            var dp = extracted.diagramSrc
                ? rasterizeSvgUrl(extracted.diagramSrc)
                : rasterizeDiagram(customDiagram);
            return dp.then(function (raster) {
                if (!raster || !raster.png) return buildTextSectionSlide(plan, ec);
                return buildPictureSectionSlide(plan, ec, raster);
            });
        }

        var content = collectSectionRows(plan, blocks);
        var diagram = firstSectionDiagram(plan, blocks);

        // Skip slide if there is genuinely nothing to show.
        if (!content.bullets.length && !diagram) return Promise.resolve(null);

        if (!diagram) return Promise.resolve(buildTextSectionSlide(plan, content));

        return rasterizeDiagram(diagram).then(function (raster) {
            if (!raster || !raster.png) return buildTextSectionSlide(plan, content);
            return buildPictureSectionSlide(plan, content, raster);
        });
    }

    // Bullet list for the Physical Network slide: total racks / nodes /
    // switches / SAN fabrics, derived from the report state. Falls back to
    // a minimal scrape from the Scenario block if the state isn't exposed.
    function extractPhysicalTopology() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s) return null;

        var bullets = [];
        var isDisagg = s.architecture === 'disaggregated';
        var rackCount = parseInt(s.disaggRackCount, 10) || 1;
        var nodesPerRack = parseInt(s.disaggNodesPerRack, 10) || 0;
        var totalNodes = parseInt(s.nodes, 10)
            || (rackCount * nodesPerRack)
            || 0;

        bullets.push({ text: 'Architecture: ' + (isDisagg ? 'Disaggregated' : 'Hyperconverged'), lvl: 1 });
        bullets.push({ text: 'Total nodes: ' + (totalNodes || 'n/a'), lvl: 1 });

        if (isDisagg) {
            bullets.push({ text: 'Racks: ' + rackCount, lvl: 1 });
            if (nodesPerRack) bullets.push({ text: 'Nodes per rack: ' + nodesPerRack, lvl: 1 });

            // Leaf switches: 2 per rack (Leaf-A / Leaf-B).
            var leafCount = rackCount * 2;
            bullets.push({ text: 'Leaf (TOR) switches: ' + leafCount + ' (2 per rack — Leaf-A / Leaf-B)', lvl: 1 });

            var spineCount = parseInt(s.disaggSpineCount, 10) || 0;
            if (spineCount) {
                bullets.push({ text: 'Spine switches: ' + spineCount, lvl: 1 });
            } else if (rackCount === 1) {
                bullets.push({ text: 'Spine switches: not required (single-rack)', lvl: 1 });
            }

            var st = s.disaggStorageType || 'fc_san';
            var stLabel = st === 'fc_san' ? 'FC SAN'
                : st === 'iscsi_4nic' ? 'iSCSI (4-NIC shared)'
                : st === 'iscsi_6nic' ? 'iSCSI (6-NIC dedicated)'
                : st;
            bullets.push({ text: 'Storage type: ' + stLabel, lvl: 1 });

            if (st === 'fc_san') {
                bullets.push({ text: 'SAN fabrics: 2 (Fabric A / Fabric B — MPIO)', lvl: 1 });
                var ports = parseInt(s.disaggPortCount, 10) || 0;
                if (ports) bullets.push({ text: 'FC HBA ports per node: ' + ports, lvl: 1 });
            } else if (st === 'iscsi_4nic' || st === 'iscsi_6nic') {
                bullets.push({ text: 'iSCSI paths: 2 (Path A / Path B)', lvl: 1 });
            }

            if (s.disaggBackupEnabled) {
                bullets.push({ text: 'In-guest backup NICs: enabled', lvl: 1 });
            }
        } else {
            // Hyperconverged: switched vs switchless storage; 2 TORs typical.
            var storageMode = s.storageType || s.storage || '';
            if (/switchless/i.test(storageMode)) {
                bullets.push({ text: 'Storage connectivity: Switchless (full-mesh between nodes)', lvl: 1 });
                bullets.push({ text: 'Top-of-rack switches: 2 (management + compute)', lvl: 1 });
            } else {
                bullets.push({ text: 'Storage connectivity: Switched', lvl: 1 });
                bullets.push({ text: 'Top-of-rack switches: 2 (combined or dedicated storage)', lvl: 1 });
            }
        }

        return {
            bullets: bullets,
            sources: ['Report state']
        };
    }

    // Custom extractor for the AKS Logical Network Reachability follow-up slide.
    // The content is rendered inline at the bottom of the Leaf & Spine Fabric
    // Requirements block: an h4 + intro paragraph + 3-row routing table + the
    // active VRF-mode diagram (single or separate) + a closing note paragraph.
    function extractAksReachability() {
        var hs = $$('#report-summary h4, #report-rationale h4');
        var h = null;
        for (var i = 0; i < hs.length; i++) {
            if (/AKS Logical Network Reachability/i.test(hs[i].textContent || '')) {
                h = hs[i]; break;
            }
        }
        if (!h) return null;
        var container = h.parentElement;
        if (!container) return null;

        var bullets = [];
        var introP = h.nextElementSibling;
        if (introP && introP.tagName === 'P') {
            var introText = plainText(introP);
            if (introText) bullets.push({ text: introText, lvl: 1 });
        }

        $$('tbody tr', container).forEach(function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length < 3) return;
            var scenario = plainText(tds[0]);
            var path = plainText(tds[1]);
            var hops = plainText(tds[2]);
            if (!scenario) return;
            var label = scenario + ': ' + path + ' (' + hops + ' hop' + (hops === '1' ? '' : 's') + ')';
            bullets.push({ text: label, lvl: 1 });
        });

        $$('p strong', container).forEach(function (s) {
            if (!/This deployment uses/i.test(s.textContent || '')) return;
            var p = s.closest('p');
            if (!p) return;
            var t = plainText(p);
            if (t) bullets.push({ text: t, lvl: 1 });
        });

        var img = container.querySelector('img[src*="aks-logical-network"]');
        var diagramSrc = img ? img.getAttribute('src') : null;

        var refUrl = 'https://learn.microsoft.com/azure/azure-local/plan/network-patterns-overview-disaggregated';
        bullets.push({
            lvl: 1,
            text: 'Reference: ' + refUrl,
            runs: [
                { text: 'Reference: ' },
                { text: refUrl, color: '93C5FD', linkRid: 100 }
            ]
        });

        return {
            bullets: bullets,
            sources: ['Leaf & Spine Fabric Requirements'],
            diagramSrc: diagramSrc,
            bulletSz: 1100,
            links: [{ rid: 100, url: refUrl }]
        };
    }

    // Leaf & Spine Architecture slide (disaggregated only). Summarises the
    // Clos fabric: rack/leaf/spine counts, underlay protocol, overlay, service
    // leaf role. VRF segmentation is intentionally NOT covered here — the
    // following slide is dedicated to AKS reachability / VRF design.
    function extractLeafSpineArchitecture() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s || s.architecture !== 'disaggregated') return null;

        var rackCount = parseInt(s.disaggRackCount, 10) || 1;
        var leafCount = rackCount * 2;
        var spineCount = parseInt(s.disaggSpineCount, 10) || 0;

        var bullets = [];
        // Sized for: ' + rackCount + ' rack(s), ' + leafCount + ' leaves, ' + spineCount + ' spines'
        bullets.push({
            text: 'This deployment: ' + rackCount + ' rack' + (rackCount === 1 ? '' : 's')
                + ', ' + leafCount + ' leaf (TOR) switches'
                + (spineCount ? ', ' + spineCount + ' spine switches' : (rackCount === 1 ? ', no spines (single-rack HSRP pair)' : '')) + '.',
            lvl: 1
        });
        bullets.push({ text: 'Why leaf-spine (Clos)?', lvl: 1 });
        bullets.push({ text: 'A traditional 2-switch TOR design breaks at scale: ~48 ports per switch can\u2019t reach 64+ nodes, a single TOR failure takes out half the cluster, and all cross-rack traffic funnels through one uplink pair.', lvl: 2 });
        bullets.push({ text: 'A Clos fabric gives every rack its own leaf pair and shares a spine layer between racks. Cross-rack traffic is always Leaf \u2192 Spine \u2192 Leaf (max 3 hops), and compute, storage and network can scale independently.', lvl: 2 });
        bullets.push({ text: 'How the fabric works (3 layers):', lvl: 1 });
        bullets.push({ text: 'Underlay \u2014 eBGP unnumbered (RFC 5549) between switches with per-rack ASNs and ECMP. Carries only loopbacks and BGP peer routes; never tenant or cluster IPs.', lvl: 2 });
        bullets.push({ text: 'Overlay \u2014 VXLAN with MP-BGP EVPN (route types 2 & 5) extends VLANs across racks. Each VLAN maps to a unique VNI; symmetric IRB routes between subnets at the leaf.', lvl: 2 });
        bullets.push({ text: 'Segmentation \u2014 separate VRFs (management, compute/cluster, tenant) keep traffic types isolated. A misconfiguration in one VRF can\u2019t leak into the others.', lvl: 2 });
        bullets.push({ text: 'Compute leaf vs. service leaf:', lvl: 1 });
        bullets.push({ text: 'Compute leaves terminate VXLAN for local nodes and act as anycast gateways. They do NOT peer with the data center core.', lvl: 2 });
        bullets.push({ text: 'A dedicated service leaf pair is the single boundary to the DC core \u2014 firewalls, load balancers, route leaking and external BGP all live there (never on the spines).', lvl: 2 });
        bullets.push({ text: 'Oversubscription target: 2:1 leaf-to-spine under normal ops (\u2248 4:1 during a spine failure). Scale spines horizontally to add ECMP paths and reduce blast radius.', lvl: 1 });
        bullets.push({ text: 'SDN on disaggregated: Microsoft Network Controller is not used. SDN LNETs (incl. AKS) live on the external fabric \u2014 plan VRFs and route leaking accordingly.', lvl: 1 });
        var refUrl = 'https://learn.microsoft.com/azure/azure-local/plan/network-patterns-overview-disaggregated';
        bullets.push({
            lvl: 1,
            text: 'Reference: ' + refUrl,
            runs: [
                { text: 'Reference: ' },
                { text: refUrl, color: '93C5FD', linkRid: 100 }
            ]
        });

        return {
            bullets: bullets,
            sources: ['Leaf & Spine Fabric Requirements'],
            bulletSz: 900,
            links: [{ rid: 100, url: refUrl }]
        };
    }

    // Proxy slide: outbound mode + arc + proxy state + the rendered minimum
    // bypass string + planning notes pulled from the rendered Outbound section
    // so the slide stays in sync with what the user sees.
    function extractProxyConfiguration() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s) return null;

        var bullets = [];

        var outboundLabel = s.outbound === 'private' ? 'Private (controlled egress via firewall/proxy)'
            : s.outbound === 'public' ? 'Public (direct, allow-listed)'
            : (s.outbound || 'n/a');
        bullets.push({ text: 'Outbound: ' + outboundLabel, lvl: 1 });

        bullets.push({
            text: 'Arc Gateway: ' + (s.arc === 'arc_gateway' ? 'Enabled (recommended)'
                : s.arc === 'no_arc' ? 'Disabled' : 'n/a'),
            lvl: 1
        });

        var proxyEnabled = s.proxy === 'proxy';
        bullets.push({
            text: 'Proxy: ' + (proxyEnabled ? 'Enabled (enterprise proxy in path)'
                : s.proxy === 'no_proxy' ? 'Disabled' : 'n/a'),
            lvl: 1
        });

        if (!proxyEnabled) {
            bullets.push({ text: 'No enterprise proxy in path — outbound goes direct (subject to firewall allow-list).', lvl: 1 });
            return { bullets: bullets, sources: ['Outbound, Arc, Proxy & Private Endpoints'] };
        }

        // Build the bypass list using the same helper the report renders with.
        var items = (typeof window.__odinBuildProxyBypassList === 'function')
            ? (window.__odinBuildProxyBypassList(s) || []) : [];

        if (items.length) {
            bullets.push({ text: 'Minimum proxy bypass list (' + items.length + ' entries):', lvl: 1 });

            var loopback = items.filter(function (e) { return /^(localhost|127\.|::1)/i.test(e); });
            var domains  = items.filter(function (e) { return e.indexOf('*.') === 0; });
            var ips      = items.filter(function (e) { return /^\d+\.\d+\.\d+\.\d+/.test(e) && loopback.indexOf(e) === -1; });
            var hostnames = items.filter(function (e) {
                return loopback.indexOf(e) === -1 && domains.indexOf(e) === -1 && ips.indexOf(e) === -1;
            });

            if (loopback.length)  bullets.push({ text: 'Loopback: ' + loopback.join(', '), lvl: 1 });
            if (hostnames.length) bullets.push({ text: 'Cluster + node names / FQDNs: ' + hostnames.slice(0, 8).join(', ') + (hostnames.length > 8 ? ' (+' + (hostnames.length - 8) + ')' : ''), lvl: 1 });
            if (ips.length)       bullets.push({ text: 'Node + infrastructure IPs: ' + ips.slice(0, 8).join(', ') + (ips.length > 8 ? ' (+' + (ips.length - 8) + ')' : ''), lvl: 1 });
            if (domains.length)   bullets.push({ text: 'Domain wildcards: ' + domains.join(', '), lvl: 1 });
        }

        // Planning notes that mirror the validation report.
        bullets.push({ text: 'Configure proxy on WinINET, WinHTTP and HTTP_PROXY/HTTPS_PROXY env vars consistently before Arc registration.', lvl: 1 });
        if (s.arc === 'arc_gateway') {
            bullets.push({ text: 'Arc Gateway tunnels OS HTTPS to Microsoft endpoints; non-Microsoft HTTPS and OS HTTP still traverse the enterprise proxy.', lvl: 1 });
        }
        bullets.push({ text: 'Ensure node, cluster and infrastructure IPs/subnets are bypassed so internal traffic does not hit the proxy.', lvl: 1 });

        var links = [];
        if (s.arc === 'arc_gateway') {
            var arcGwUrl = 'https://learn.microsoft.com/azure/azure-local/deploy/deployment-azure-arc-gateway-overview?tabs=portal';
            bullets.push({
                lvl: 1,
                text: 'Reference: ' + arcGwUrl,
                runs: [
                    { text: 'Reference: ' },
                    { text: arcGwUrl, color: '93C5FD', linkRid: 100 }
                ]
            });
            links.push({ rid: 100, url: arcGwUrl });
        }

        return {
            bullets: bullets,
            sources: ['Outbound, Arc, Proxy & Private Endpoints'],
            links: links
        };
    }

    // Private Endpoints slide: per-PE name + Private Link FQDN + the most
    // important note (e.g., "Wildcards NOT supported", "Not allowed via Arc
    // Gateway"). Adds an Arc Gateway warning if any selected service is
    // documented as not supported via Arc Gateway.
    function extractPrivateEndpoints() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s) return null;

        var bullets = [];
        var enabled = s.privateEndpoints === 'pe_enabled'
            && s.privateEndpointsList && s.privateEndpointsList.length > 0;

        if (!enabled) {
            bullets.push({
                text: 'Private Endpoints: ' + (s.privateEndpoints === 'pe_disabled' ? 'Disabled' : 'Not configured'),
                lvl: 1
            });
            bullets.push({ text: 'Azure services reached via their public endpoints (subject to outbound + Arc Gateway / proxy policy).', lvl: 1 });
            return { bullets: bullets, sources: ['Outbound, Arc, Proxy & Private Endpoints'] };
        }

        bullets.push({
            text: 'Private Endpoints enabled — ' + s.privateEndpointsList.length + ' service'
                + (s.privateEndpointsList.length === 1 ? '' : 's') + ' selected:',
            lvl: 1
        });

        var PEI = (typeof window.__odinGetPrivateEndpointInfo === 'function')
            ? (window.__odinGetPrivateEndpointInfo() || {}) : {};
        var arcGwBlocked = [];

        s.privateEndpointsList.forEach(function (key) {
            var info = PEI[key];
            if (!info) {
                bullets.push({ text: key, lvl: 1 });
                return;
            }
            bullets.push({ text: (info.icon ? info.icon + ' ' : '') + info.name + ' — Private Link: ' + info.privateLink, lvl: 1 });
            if (info.notes) {
                bullets.push({ text: '↳ ' + info.notes, lvl: 2 });
                if (/Not allowed via Arc Gateway/i.test(info.notes)) arcGwBlocked.push(info.name);
            }
            if (info.considerations && info.considerations.length) {
                // Surface the single most important consideration (typically
                // the wildcard / Arc Gateway / DNS caveat).
                var pick = info.considerations.find(function (c) {
                    return /Wildcard|Arc Gateway|NOT supported|Required|Important|Cannot/i.test(c);
                }) || info.considerations[0];
                if (pick) bullets.push({ text: '↳ ' + pick, lvl: 2 });
            }
        });

        if (s.arc === 'arc_gateway' && arcGwBlocked.length) {
            bullets.push({
                text: '⚠ Arc Private Link warning: ' + arcGwBlocked.join(', ')
                    + ' — not supported via Arc Gateway. Traffic must go directly to the private endpoint.',
                lvl: 1
            });
        }

        bullets.push({ text: 'DNS must resolve privatelink.* zones to private endpoint IPs.', lvl: 1 });
        if (s.proxy === 'proxy' || s.arc === 'arc_gateway') {
            bullets.push({ text: 'Add Private Link FQDNs to proxy bypass list (no wildcards for ACR).', lvl: 1 });
        }

        var refUrl = 'https://learn.microsoft.com/azure/azure-local/deploy/about-private-endpoints';
        bullets.push({
            lvl: 1,
            text: 'Reference: ' + refUrl,
            runs: [
                { text: 'Reference: ' },
                { text: refUrl, color: '93C5FD', linkRid: 100 }
            ]
        });

        // Red callout banner: Arc Private Link is not a supported scenario
        // for Azure Arc-enabled Azure Local clusters — the Arc agents on the
        // nodes must reach the Arc public endpoints (or go via Arc Gateway).
        var calloutText = '\u26A0  Arc Private Link is NOT supported on Azure Local. '
            + 'Arc agents must reach Arc public endpoints (or via Arc Gateway).';
        var calloutSp = floatingCallout(
            50, 'Arc PL Warning',
            BULLETS_XFRM_LAYOUT9.x, 5950000,
            BULLETS_XFRM_LAYOUT9.cx, 600000,
            'B91C1C', calloutText, 'FFFFFF', 1400
        );

        return {
            bullets: bullets,
            sources: ['Outbound, Arc, Proxy & Private Endpoints'],
            extraSps: [calloutSp],
            links: [{ rid: 100, url: refUrl }]
        };
    }

    // Infrastructure Network slide: brief subnet facts as bullets PLUS a
    // generated subnet utilisation bar pinned to the bottom of the slide
    // showing how the /N is consumed by gateway, infra IP pool, and node IPs.
    function extractInfraNetwork(blocks) {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;

        // Always start from the rendered rows so labels/values stay
        // consistent with the on-screen report.
        var base = collectSectionRows({ match: ['Infrastructure Network', 'IP, Infrastructure Network'] }, blocks);
        var bullets = base.bullets;
        var sources = base.sources;

        var svg = null;
        if (s && s.infraCidr) {
            svg = buildInfraSubnetBarSvg(s);
        }
        return { bullets: bullets, sources: sources, footerSvgString: svg };
    }

    // Deployment Scenario & Scale slide: render the key facts as a card grid
    // (one rounded square per property with a related icon, label, and value)
    // instead of a bullet list. Returns a `bodySvgString` so the slide
    // builder picks the SVG-only layout.
    function extractScenarioScale() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s) return null;

        var isDisagg = s.architecture === 'disaggregated';
        var rackCount = parseInt(s.disaggRackCount, 10) || 1;
        var nodesPerRack = parseInt(s.disaggNodesPerRack, 10) || 0;
        var nodes = parseInt(s.nodes, 10) || (rackCount * nodesPerRack) || 0;

        // Region label: prefer the rendered Scenario block which already
        // resolves the region key to a friendly name.
        var regionLabel = s.localInstanceRegion || '\u2014';
        var cloudLabel = (s.azureCloud || 'commercial').toLowerCase() === 'usgov'
            ? 'Azure US Government' : 'Azure Commercial';

        var storageLabel;
        if (isDisagg) {
            storageLabel = (s.disaggStorageType || '').toUpperCase().replace('_', ' ') || 'External';
        } else if (s.storage === 'switched_storage') {
            storageLabel = 'Switched Storage';
        } else if (s.storage === 'switchless_storage') {
            storageLabel = 'Switchless Storage';
        } else {
            storageLabel = s.storage || '\u2014';
        }

        var ports = isDisagg
            ? (parseInt(s.disaggPortCount, 10) || '\u2014')
            : (parseInt(s.ports, 10) || '\u2014');

        var witnessLabel = '\u2014';
        if (s.cloudWitness === 'cloud_witness') witnessLabel = 'Cloud Witness';
        else if (s.cloudWitness === 'no_witness') witnessLabel = 'No Witness';
        else if (s.cloudWitness) witnessLabel = String(s.cloudWitness);

        var cards = [
            { icon: 'cloud',     label: 'Scenario',     value: (s.scenario || '\u2014') === 'connected' ? 'Connected' : 'Disconnected' },
            { icon: 'cube',      label: 'Architecture', value: isDisagg ? 'Disaggregated' : 'Hyperconverged' },
            { icon: 'globe',     label: 'Azure Cloud',  value: cloudLabel },
            { icon: 'pin',       label: 'Region',       value: regionLabel },
            { icon: 'server',    label: 'Nodes',        value: String(nodes) },
            { icon: 'rack',      label: 'Racks',        value: String(rackCount) + (isDisagg && nodesPerRack ? ' \u00d7 ' + nodesPerRack + ' nodes' : '') },
            { icon: 'disk',      label: 'Storage',      value: storageLabel },
            { icon: 'port',      label: 'Ports / Node', value: String(ports) },
            { icon: 'witness',   label: 'Witness',      value: witnessLabel }
        ];

        return {
            bullets: [],
            sources: ['Scenario & Scale'],
            bodySvgString: buildScenarioCardsSvg(cards)
        };
    }

    // Renders an N-card grid as an SVG. 3 columns × ceil(N/3) rows.
    function buildScenarioCardsSvg(cards) {
        var W = 1600, H = 720;
        var pad = 40;
        var cols = 3;
        var rows = Math.ceil(cards.length / cols);
        var gap = 28;
        var cardW = Math.floor((W - pad * 2 - gap * (cols - 1)) / cols);
        var cardH = Math.floor((H - pad * 2 - gap * (rows - 1)) / rows);

        function cardXml(c, idx) {
            var col = idx % cols;
            var row = Math.floor(idx / cols);
            var x = pad + col * (cardW + gap);
            var y = pad + row * (cardH + gap);
            // Rounded card with subtle border + accent stripe at top.
            var iconCx = x + 70, iconCy = y + cardH / 2;
            var iconR = 38;
            var labelX = x + 130, labelY = y + cardH / 2 - 12;
            var valueX = labelX,  valueY = y + cardH / 2 + 28;
            return ''
                + '<rect x="' + x + '" y="' + y + '" width="' + cardW + '" height="' + cardH + '" rx="14" ry="14" fill="#111827" stroke="#334155" stroke-width="1.5"/>'
                + '<rect x="' + x + '" y="' + y + '" width="' + cardW + '" height="6" rx="14" ry="14" fill="#22d3ee"/>'
                + '<circle cx="' + iconCx + '" cy="' + iconCy + '" r="' + iconR + '" fill="#1e293b" stroke="#22d3ee" stroke-width="1.5"/>'
                + iconGlyph(c.icon, iconCx, iconCy)
                + '<text x="' + labelX + '" y="' + labelY + '" fill="#94a3b8" font-size="20" font-family="Segoe UI, Arial, sans-serif" font-weight="600" letter-spacing="1">' + escXml(String(c.label).toUpperCase()) + '</text>'
                + '<text x="' + valueX + '" y="' + valueY + '" fill="#f1f5f9" font-size="32" font-family="Segoe UI, Arial, sans-serif" font-weight="700">' + escXml(String(c.value)) + '</text>';
        }

        return ''
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
            + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + DIAGRAM_BG + '"/>'
            + cards.map(cardXml).join('')
            + '</svg>';
    }

    // Tiny inline icon set (centered at cx, cy). Stroked white-ish over the
    // accent ring; 24px nominal box.
    function iconGlyph(name, cx, cy) {
        var stroke = '#22d3ee';
        var sw = 2.2;
        var s = 18; // half-extent
        function p(d) {
            return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" transform="translate(' + (cx - s) + ' ' + (cy - s) + ')"/>';
        }
        switch (name) {
            case 'cloud':
                return p('M9 24c-3 0-5-2-5-5 0-2.5 2-4.5 4.5-4.8C9 10 12 7.5 15.5 7.5 19 7.5 22 10 22 13.5c0 .2 0 .4-.1.6 2.3.4 4 2.4 4 4.8 0 2.7-2.2 5-4.9 5H9z');
            case 'cube':
                return p('M18 4 4 11v14l14 7 14-7V11L18 4z M4 11l14 7 14-7 M18 18v14');
            case 'globe':
                return p('M18 4a14 14 0 1 0 0 28 14 14 0 0 0 0-28z M4 18h28 M18 4c4 4 6 9 6 14s-2 10-6 14c-4-4-6-9-6-14s2-10 6-14z');
            case 'pin':
                return p('M18 4c-5 0-9 4-9 9 0 7 9 19 9 19s9-12 9-19c0-5-4-9-9-9z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z');
            case 'server':
                return p('M6 8h24v8H6z M6 20h24v8H6z M10 12h.01 M10 24h.01 M16 12h6 M16 24h6');
            case 'rack':
                return p('M5 5h26v26H5z M5 12h26 M5 19h26 M5 26h26');
            case 'disk':
                return p('M5 9c0-2 6-4 13-4s13 2 13 4v18c0 2-6 4-13 4S5 29 5 27V9z M5 9c0 2 6 4 13 4s13-2 13-4 M5 18c0 2 6 4 13 4s13-2 13-4');
            case 'port':
                return p('M5 12h26v12H5z M9 12v-4h4v4 M17 12v-4h4v4 M25 12v-4h4v4 M11 18h.01 M19 18h.01 M27 18h.01');
            case 'witness':
                return p('M18 4 6 9v9c0 8 5 13 12 16 7-3 12-8 12-16V9L18 4z M12 18l4 4 8-8');
            default:
                return '';
        }
    }

    // Sizer Workloads slide: per-workload breakdown (VM / AKS / AVD) when
    // the report was started from the Sizer. Returns null when no Sizer
    // workload data is present, which makes the slide auto-skip.
    function extractSizerWorkloads() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s || !Array.isArray(s.sizerWorkloads) || s.sizerWorkloads.length === 0) {
            return null;
        }

        var typeLabels = { vm: 'Azure Local VMs', aks: 'AKS Arc Cluster', avd: 'Azure Virtual Desktop' };
        var avdProfileLabels = { light: 'Light', medium: 'Medium', heavy: 'Heavy', power: 'Power', custom: 'Custom' };

        function fmtStorage(gb) {
            var n = Number(gb) || 0;
            return n >= 1024 ? (n / 1024).toFixed(1) + ' TB' : n + ' GB';
        }

        var bullets = [];

        // Cluster-wide totals (matches the "Hardware Configuration (from Sizer)"
        // workloadSummary block already shown on the Node Configuration slide).
        var ws = s.sizerHardware && s.sizerHardware.workloadSummary;
        if (ws) {
            var totalLine = (ws.count || s.sizerWorkloads.length) + ' workloads'
                + ' \u00b7 ' + (ws.totalVcpus || 0) + ' vCPUs'
                + ' \u00b7 ' + (ws.totalMemoryGB || 0) + ' GB memory'
                + ' \u00b7 ' + (ws.totalStorageTB != null ? ws.totalStorageTB + ' TB' : fmtStorage((ws.totalStorageGB || 0)))
                + ' storage';
            bullets.push({ text: 'Total: ' + totalLine, lvl: 1 });
        }

        // One headline + one subtotal bullet per workload.
        for (var i = 0; i < s.sizerWorkloads.length; i++) {
            var wl = s.sizerWorkloads[i];
            var name = wl.name || typeLabels[wl.type] || wl.type;
            var typeLabel = typeLabels[wl.type] || wl.type;
            var headline;
            if (wl.type === 'vm') {
                headline = (wl.count || 0) + ' VMs \u00d7 '
                    + (wl.vcpusPerVm || 0) + ' vCPU / '
                    + (wl.memoryPerVmGB || 0) + ' GB / '
                    + (wl.storagePerVmGB || 0) + ' GB';
            } else if (wl.type === 'aks') {
                headline = (wl.clusterCount || 0) + ' clusters \u00b7 CP '
                    + (wl.controlPlaneNodes || 0) + '\u00d7' + (wl.controlPlaneVcpus || 0) + 'vCPU/' + (wl.controlPlaneMemory || 0) + 'GB'
                    + ' \u00b7 Workers '
                    + (wl.workerNodes || 0) + '\u00d7' + (wl.workerVcpus || 0) + 'vCPU/' + (wl.workerMemory || 0) + 'GB/' + (wl.workerStorage || 0) + 'GB';
            } else if (wl.type === 'avd') {
                var profile = avdProfileLabels[wl.profile] || wl.profile || '\u2014';
                var session = wl.sessionType === 'single' ? 'Single-session' : 'Multi-session';
                headline = (wl.userCount || 0) + ' users \u00b7 ' + profile + ' \u00b7 ' + session;
                if (wl.sessionType !== 'single') headline += ' (' + (wl.concurrency || 100) + '%)';
                if (wl.fslogix) headline += ' \u00b7 FSLogix ' + (wl.fslogixSize || 30) + ' GB';
                if (wl.profile === 'custom') {
                    headline += ' \u00b7 Custom ' + (wl.customVcpus || 0) + 'vCPU/' + (wl.customMemory || 0) + 'GB/' + (wl.customStorage || 0) + 'GB';
                }
            } else {
                headline = '\u2014';
            }
            bullets.push({ text: name + ' (' + typeLabel + ') \u2014 ' + headline, lvl: 1 });
            bullets.push({
                text: 'Subtotal: ' + (wl.totalVcpus || 0) + ' vCPUs \u00b7 '
                    + (wl.totalMemoryGB || 0) + ' GB memory \u00b7 '
                    + fmtStorage(wl.totalStorageGB) + ' storage',
                lvl: 2
            });
        }

        return {
            bullets: bullets,
            sources: ['Workloads (from Sizer)']
        };
    }

    // Security Configuration slide: always show all 7 security settings with
    // their effective state (Enabled / Disabled), the chosen mode
    // (Recommended / Customized), and a short description per setting.
    // Recommended mode = all 7 enabled (matches the wizard defaults).
    function extractSecurityConfiguration() {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        if (!s) return null;

        var mode = s.securityConfiguration === 'customized' ? 'Customized' : 'Recommended';
        var settings = (mode === 'Customized' && s.securitySettings) ? s.securitySettings : {
            driftControlEnforced: true,
            wdacEnforced: true,
            credentialGuardEnforced: true,
            smbSigningEnforced: true,
            smbClusterEncryption: true,
            bitlockerBootVolume: true,
            bitlockerDataVolumes: true
        };

        function state(v) { return v ? '\u2713 Enabled' : '\u2717 Disabled'; }
        // Build a paragraph with a colored ✓/✗ + state run, then the rest in default color.
        function row(label, v, desc) {
            return {
                lvl: 2,
                text: label + ': ' + state(v) + ' \u2014 ' + desc,
                runs: [
                    { text: label + ': ' },
                    { text: state(v), color: v ? '22c55e' : 'ef4444' },
                    { text: ' \u2014 ' + desc }
                ]
            };
        }

        var bullets = [];
        bullets.push({ text: 'Configuration mode: ' + mode + (mode === 'Recommended' ? ' (all controls enforced)' : ''), lvl: 1 });
        bullets.push(row('Drift Control', settings.driftControlEnforced, 'prevents unauthorised changes to security baseline.'));
        bullets.push(row('WDAC (Windows Defender Application Control)', settings.wdacEnforced, 'only signed/approved code runs on cluster nodes.'));
        bullets.push(row('Credential Guard', settings.credentialGuardEnforced, 'isolates LSA secrets in a VBS container; blocks pass-the-hash.'));
        bullets.push(row('SMB Signing', settings.smbSigningEnforced, 'mandatory packet signing on all SMB sessions.'));
        bullets.push(row('SMB Cluster Encryption', settings.smbClusterEncryption, 'encrypts intra-cluster SMB (storage, live migration).'));
        bullets.push(row('BitLocker on Boot Volume', settings.bitlockerBootVolume, 'encrypts OS volume; requires TPM + recovery key escrow.'));
        bullets.push(row('BitLocker on Data Volumes (CSVs)', settings.bitlockerDataVolumes, 'encrypts cluster shared volumes at rest.'));

        return { bullets: bullets, sources: ['Security Configuration'] };
    }

    // ---- Subnet utilisation bar (SVG) -------------------------------------
    function ipToInt(ip) {
        var o = String(ip || '').split('.').map(Number);
        if (o.length !== 4 || o.some(function (n) { return isNaN(n); })) return null;
        return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
    }

    function buildInfraSubnetBarSvg(s) {
        var cidr = String(s.infraCidr || '').trim();
        var m = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
        if (!m) return null;
        var prefix = parseInt(m[2], 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
        var baseInt = ipToInt(m[1]);
        if (baseInt === null) return null;
        // Align base to network address.
        var hostBits = 32 - prefix;
        var size = Math.pow(2, hostBits);
        baseInt = baseInt - (baseInt % size);

        // Collect used ranges as { start, end (inclusive), kind, label }.
        var used = [];
        var gwInt = ipToInt(s.infraGateway);
        if (gwInt !== null) used.push({ start: gwInt, end: gwInt, kind: 'gw' });
        if (s.infra && s.infra.start && s.infra.end) {
            var ps = ipToInt(s.infra.start), pe = ipToInt(s.infra.end);
            if (ps !== null && pe !== null && pe >= ps) {
                used.push({ start: ps, end: pe, kind: 'pool' });
            }
        }
        if (Array.isArray(s.nodeSettings)) {
            // Group contiguous node IPs into runs for cleaner bar segments.
            var ips = s.nodeSettings.map(function (n) {
                return n && n.ipCidr ? ipToInt(String(n.ipCidr).split('/')[0]) : null;
            }).filter(function (v) { return v !== null; }).sort(function (a, b) { return a - b; });
            if (ips.length) {
                var run = { start: ips[0], end: ips[0] };
                for (var i = 1; i < ips.length; i++) {
                    if (ips[i] === run.end + 1) { run.end = ips[i]; }
                    else { used.push({ start: run.start, end: run.end, kind: 'node' }); run = { start: ips[i], end: ips[i] }; }
                }
                used.push({ start: run.start, end: run.end, kind: 'node' });
            }
        }

        // Layout. Width chosen to be readable when scaled to slide footer.
        var W = 1600, H = 320;
        var pad = 30;
        var barX = pad, barY = 90, barW = W - pad * 2, barH = 70;
        var COLOR = {
            unused: '#1f2937',
            border: '#475569',
            gw:    '#fbbf24',
            pool:  '#3b82f6',
            node:  '#10b981'
        };
        var TEXT = '#e5e7eb';

        function pxFor(intVal) {
            var rel = intVal - baseInt;
            return barX + Math.round((rel / size) * barW);
        }

        // Counts for legend
        var nodeCount = used.filter(function (u) { return u.kind === 'node'; })
            .reduce(function (a, u) { return a + (u.end - u.start + 1); }, 0);
        var poolEntry = used.find(function (u) { return u.kind === 'pool'; });
        var poolCount = poolEntry ? (poolEntry.end - poolEntry.start + 1) : 0;
        var totalUsable = size > 2 ? size - 2 : size; // exclude network + broadcast
        var totalUsed = nodeCount + poolCount + (gwInt !== null ? 1 : 0);

        var endIp = baseInt + size - 1;
        function intToIp(v) {
            return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff].join('.');
        }

        // Build segment rects. Order: pool first (wide), then nodes, then gw
        // so single-pixel slivers stay visible on top.
        var segs = '';
        used.sort(function (a, b) {
            var rank = { pool: 0, node: 1, gw: 2 };
            return rank[a.kind] - rank[b.kind];
        }).forEach(function (u) {
            var x1 = pxFor(u.start);
            var x2 = pxFor(u.end + 1);
            var w = Math.max(2, x2 - x1);
            segs += '<rect x="' + x1 + '" y="' + barY + '" width="' + w + '" height="' + barH + '" fill="' + COLOR[u.kind] + '"/>';
        });

        // Title / subtitle
        var title = 'Infrastructure Subnet Utilisation — ' + cidr + '  (' + size + ' addresses)';
        var subtitle = 'Used: ' + totalUsed + ' / ' + totalUsable + ' usable  ·  '
            + 'Gateway: ' + (gwInt !== null ? intToIp(gwInt) : '—') + '  ·  '
            + 'Pool: ' + (poolEntry ? intToIp(poolEntry.start) + '–' + intToIp(poolEntry.end) + ' (' + poolCount + ')' : '—') + '  ·  '
            + 'Nodes: ' + nodeCount;

        // Legend
        var legendY = barY + barH + 60;
        function legendItem(x, color, label) {
            return '<rect x="' + x + '" y="' + (legendY - 14) + '" width="22" height="16" fill="' + color + '"/>'
                + '<text x="' + (x + 30) + '" y="' + legendY + '" fill="' + TEXT + '" font-size="20" font-family="Segoe UI, Arial, sans-serif">' + label + '</text>';
        }

        var svg = ''
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
            + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + DIAGRAM_BG + '"/>'
            + '<text x="' + pad + '" y="40" fill="' + TEXT + '" font-size="26" font-weight="700" font-family="Segoe UI, Arial, sans-serif">' + escXml(title) + '</text>'
            + '<text x="' + pad + '" y="72" fill="#94a3b8" font-size="20" font-family="Segoe UI, Arial, sans-serif">' + escXml(subtitle) + '</text>'
            // unused background
            + '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="' + COLOR.unused + '"/>'
            + segs
            + '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="none" stroke="' + COLOR.border + '" stroke-width="1.5"/>'
            // axis labels
            + '<text x="' + barX + '" y="' + (barY + barH + 26) + '" fill="#94a3b8" font-size="18" font-family="Segoe UI, Arial, sans-serif">' + intToIp(baseInt) + '</text>'
            + '<text x="' + (barX + barW) + '" y="' + (barY + barH + 26) + '" text-anchor="end" fill="#94a3b8" font-size="18" font-family="Segoe UI, Arial, sans-serif">' + intToIp(endIp) + '</text>'
            + legendItem(pad,        COLOR.gw,   'Default Gateway (' + (gwInt !== null ? '1' : '0') + ')')
            + legendItem(pad + 320,  COLOR.pool, 'Infra IP Pool (' + poolCount + ' — incl. Cluster IP + 3 ARB IPs)')
            + legendItem(pad + 940,  COLOR.node, 'Node IPs (' + nodeCount + ')')
            + legendItem(pad + 1240, COLOR.unused, 'Unused (' + Math.max(0, totalUsable - totalUsed) + ')')
            + '</svg>';
        return svg;
    }

    // Host Networking slide: existing label/value rows from the rendered
    // section, prepended with NIC count / speeds / RDMA-enabled count derived
    // from portConfig (HCI) or disaggPortConfig (disaggregated) so the deck
    // shows the physical adapter facts that the report doesn't surface as rows.
    function extractHostNetworking(blocks) {
        var s = (typeof window.__odinGetReportState === 'function')
            ? window.__odinGetReportState() : null;
        var bullets = [];
        var nicSummary = buildNicSummary(s);
        nicSummary.forEach(function (line) { bullets.push({ text: line, lvl: 1 }); });

        // Pull the matched section rows so we keep the existing intent /
        // VLAN / subnet detail.
        var matchTitles = ['Host Networking', 'Disaggregated Host Networking', 'Traffic Intent'];
        var seen = Object.create(null);
        bullets.forEach(function (b) { seen[b.text.toLowerCase()] = true; });
        (blocks || []).forEach(function (b) {
            var hit = matchTitles.some(function (p) { return titleMatches(b.title, p); });
            if (!hit) return;
            (b.rows || []).forEach(function (r) {
                var t = r.label + ': ' + r.value;
                var k = t.toLowerCase();
                if (seen[k]) return;
                seen[k] = true;
                bullets.push({ text: t, lvl: 1 });
            });
        });

        var refUrl = getNetworkPatternUrl(s);
        bullets.push({
            lvl: 1,
            text: 'Reference: ' + refUrl,
            runs: [
                { text: 'Reference: ' },
                { text: refUrl, color: '93C5FD', linkRid: 100 }
            ]
        });

        return {
            bullets: bullets,
            sources: ['Host Networking + adapter config'],
            links: [{ rid: 100, url: refUrl }]
        };
    }

    // Pick the most relevant Microsoft Learn network pattern article for the
    // selected configuration. Falls back to the patterns overview hub.
    function getNetworkPatternUrl(s) {
        var BASE = 'https://learn.microsoft.com/azure/azure-local/plan/';
        if (!s) return BASE + 'choose-network-pattern';
        if (s.architecture === 'disaggregated') {
            return s.disaggBackupEnabled
                ? BASE + 'fiber-channel-with-backup-disaggregated-pattern'
                : BASE + 'fiber-channel-no-backup-disaggregated-pattern';
        }
        var nodes = parseInt(s.nodes, 10) || 0;
        if (nodes <= 1) return BASE + 'single-server-deployment';
        if (s.storage === 'switchless') {
            if (nodes === 2) return BASE + 'two-node-switchless-two-switches';
            if (nodes === 3) return BASE + 'three-node-switchless-two-switches-two-links';
            return BASE + 'four-node-switchless-two-switches-two-links';
        }
        if (nodes === 2) return BASE + 'two-node-switched-two-switches';
        return BASE + 'three-node-switched-two-switches-no-storage-switches';
    }

    // Returns a list of bullet strings describing NIC topology: total ports,
    // speed mix, RDMA-enabled count. Works for both architectures.
    function buildNicSummary(s) {
        if (!s) return [];
        var out = [];

        if (s.architecture === 'disaggregated') {
            var pc = s.disaggPortConfig || {};
            var keys = Object.keys(pc).filter(function (k) {
                // BMC port doesn't count as a data NIC.
                return pc[k] && k.indexOf('bmc') !== 0;
            });
            if (!keys.length) {
                // Fall back to default NIC slots when ports haven't been
                // individually configured.
                var ports = parseInt(s.disaggPortCount, 10) || 0;
                if (ports) out.push('NICs per node: ' + ports + ' data ports + 1 BMC');
                return out;
            }
            out.push('NICs per node: ' + keys.length + ' data ports + 1 BMC');

            var bySpeed = {};
            var rdmaCount = 0;
            keys.forEach(function (k) {
                var sp = (pc[k].speed) || (s.disaggPortSpeeds && s.disaggPortSpeeds[k.split('_')[0]]) || 'unknown';
                bySpeed[sp] = (bySpeed[sp] || 0) + 1;
                if (pc[k].rdma === true) rdmaCount += 1;
            });
            var speedParts = Object.keys(bySpeed).map(function (sp) {
                return bySpeed[sp] + '× ' + sp;
            });
            if (speedParts.length) out.push('Port speeds: ' + speedParts.join(', '));
            out.push('RDMA-capable ports: ' + rdmaCount + ' / ' + keys.length);
            return out;
        }

        // Hyperconverged
        var cfg = Array.isArray(s.portConfig) ? s.portConfig : [];
        if (!cfg.length) {
            var nports = parseInt(s.ports, 10) || 0;
            if (nports) out.push('NICs per node: ' + nports);
            return out;
        }
        out.push('NICs per node: ' + cfg.length);
        var bySpeed2 = {};
        var rdma = 0;
        cfg.forEach(function (p) {
            var sp = (p && p.speed) || 'unknown';
            bySpeed2[sp] = (bySpeed2[sp] || 0) + 1;
            if (p && p.rdma === true) rdma += 1;
        });
        var sp2 = Object.keys(bySpeed2).map(function (k) { return bySpeed2[k] + '× ' + k; });
        if (sp2.length) out.push('Port speeds: ' + sp2.join(', '));
        out.push('RDMA-capable ports: ' + rdma + ' / ' + cfg.length);
        return out;
    }

    // ---------- Logo ----------

    var LOGO_URL = '../images/odin-logo.png';

    function fetchLogoBase64() {
        return fetch(LOGO_URL, { credentials: 'omit', cache: 'force-cache' })
            .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
            .then(function (buf) {
                if (!buf) return null;
                var bytes = new Uint8Array(buf);
                var bin = '';
                for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
                return btoa(bin);
            })
            .catch(function () { return null; });
    }

    // ---------- Package assembly ----------

    function fetchTemplate() {
        return fetch(TEMPLATE_URL, { credentials: 'omit', cache: 'force-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('Could not load template (' + r.status + ')');
                return r.arrayBuffer();
            });
    }

    function buildPackage(slides) {
        if (!window.JSZip) {
            throw new Error('JSZip is not available. Ensure pptxgen.bundle.js is loaded.');
        }
        return fetchTemplate().then(function (buf) {
            return window.JSZip.loadAsync(buf);
        }).then(function (zip) {
            var toDrop = [];
            zip.forEach(function (path) {
                if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) toDrop.push(path);
                else if (/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(path)) toDrop.push(path);
                else if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)) toDrop.push(path);
                else if (/^ppt\/notesSlides\/_rels\/notesSlide\d+\.xml\.rels$/.test(path)) toDrop.push(path);
                else if (path.indexOf('ppt/notesMasters/') === 0) toDrop.push(path);
                else if (path.indexOf('ppt/handoutMasters/') === 0) toDrop.push(path);
                else if (path === 'ppt/theme/theme2.xml' || path === 'ppt/theme/theme3.xml') toDrop.push(path);
            });
            toDrop.forEach(function (p) { zip.remove(p); });

            // Strip decorative <p:pic> baked into the template's cover/closing layouts so
            // a stray graphic doesn't paint over our content.
            var stripPicLayouts = [
                'ppt/slideLayouts/slideLayout1.xml',
                'ppt/slideLayouts/slideLayout14.xml'
            ];
            return Promise.all(stripPicLayouts.map(function (path) {
                return zip.file(path).async('string').then(function (lx) {
                    lx = lx.replace(/<p:pic\b[\s\S]*?<\/p:pic>/g, '');
                    zip.file(path, lx);
                });
            })).then(function () { return zip; });
        }).then(function (zip) {
            slides.forEach(function (sl, i) {
                zip.file('ppt/slides/slide' + (i + 1) + '.xml', slideXml(sl.sps));
                zip.file('ppt/slides/_rels/slide' + (i + 1) + '.xml.rels',
                    slideRels(sl.layout, sl.images || [], sl.links || []));
                (sl.images || []).forEach(function (img) {
                    if (img.png) zip.file('ppt/media/' + img.target, img.png, { base64: true });
                });
            });

            return zip.file('ppt/presentation.xml').async('string').then(function (presXml) {
                presXml = presXml.replace(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/g, '');
                presXml = presXml.replace(/<p:handoutMasterIdLst>[\s\S]*?<\/p:handoutMasterIdLst>/g, '');
                var sldIds = '';
                for (var i = 0; i < slides.length; i++) {
                    sldIds += '<p:sldId id="' + (256 + i) + '" r:id="rId' + (100 + i) + '"/>';
                }
                presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, '<p:sldIdLst>' + sldIds + '</p:sldIdLst>');
                zip.file('ppt/presentation.xml', presXml);
                return zip;
            });
        }).then(function (zip) {
            return zip.file('ppt/_rels/presentation.xml.rels').async('string').then(function (relsXml) {
                relsXml = relsXml.replace(/<Relationship\b[^>]*Type="[^"]*\/relationships\/slide"[^>]*\/>/g, '');
                relsXml = relsXml.replace(/<Relationship\b[^>]*Type="[^"]*\/relationships\/notesMaster"[^>]*\/>/g, '');
                relsXml = relsXml.replace(/<Relationship\b[^>]*Type="[^"]*\/relationships\/handoutMaster"[^>]*\/>/g, '');
                var add = '';
                for (var i = 0; i < slides.length; i++) {
                    add += '<Relationship Id="rId' + (100 + i) + '" Type="' + SLIDE_REL +
                        '" Target="slides/slide' + (i + 1) + '.xml"/>';
                }
                relsXml = relsXml.replace('</Relationships>', add + '</Relationships>');
                zip.file('ppt/_rels/presentation.xml.rels', relsXml);
                return zip;
            });
        }).then(function (zip) {
            return zip.file('[Content_Types].xml').async('string').then(function (ctXml) {
                ctXml = ctXml.split(TEMPLATE_CT).join(PRES_CT);
                ctXml = ctXml.replace(/<Override\b[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '');
                ctXml = ctXml.replace(/<Override\b[^>]*PartName="\/ppt\/notesSlides\/notesSlide\d+\.xml"[^>]*\/>/g, '');
                ctXml = ctXml.replace(/<Override\b[^>]*PartName="\/ppt\/notesMasters\/[^"]*"[^>]*\/>/g, '');
                ctXml = ctXml.replace(/<Override\b[^>]*PartName="\/ppt\/handoutMasters\/[^"]*"[^>]*\/>/g, '');
                ctXml = ctXml.replace(/<Override\b[^>]*PartName="\/ppt\/theme\/theme2\.xml"[^>]*\/>/g, '');
                ctXml = ctXml.replace(/<Override\b[^>]*PartName="\/ppt\/theme\/theme3\.xml"[^>]*\/>/g, '');
                var add = '';
                for (var i = 0; i < slides.length; i++) {
                    add += '<Override PartName="/ppt/slides/slide' + (i + 1) +
                        '.xml" ContentType="' + SLIDE_CT + '"/>';
                }
                ctXml = ctXml.replace('</Types>', add + '</Types>');
                if (ctXml.indexOf('Extension="png"') === -1) {
                    ctXml = ctXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
                }
                zip.file('[Content_Types].xml', ctXml);
                return zip;
            });
        }).then(function (zip) {
            return zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                compression: 'DEFLATE'
            });
        });
    }

    function triggerDownload(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    // ---------- Public API ----------

    function downloadReportPptx(_themeName) {
        var btn = document.getElementById('pptx-export-btn');
        if (btn) { btn.disabled = true; btn.dataset._origText = btn.textContent; btn.textContent = 'Building…'; }

        function reset() {
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset._origText || 'Download PPTX';
                delete btn.dataset._origText;
            }
        }

        try {
            var meta = scrapeMeta();
            var blocks = scrapeBlocks();
            var reportState = (typeof window.__odinGetReportState === 'function')
                ? window.__odinGetReportState()
                : null;
            var isDisagg = !!(reportState && reportState.architecture === 'disaggregated');

            fetchLogoBase64().then(function (logoPng) {
                var plan = [Promise.resolve(buildCoverSlide(meta, logoPng))];
                SECTION_PLAN.forEach(function (entry) {
                    plan.push(buildSectionSlide(entry, blocks, isDisagg));
                });
                plan.push(Promise.resolve(buildClosingSlide()));
                return Promise.all(plan);
            }).then(function (resolved) {
                var slides = resolved.filter(Boolean);
                // Renumber image targets so each slide's media file has a unique name.
                var imgIdx = 0;
                slides.forEach(function (sl) {
                    (sl.images || []).forEach(function (img) {
                        imgIdx += 1;
                        img.target = 'image' + imgIdx + '.png';
                    });
                });
                return buildPackage(slides);
            }).then(function (blob) {
                var name = 'odin-configuration-report_' + nowStamp() + '.pptx';
                triggerDownload(blob, name);
            }).catch(function (err) {
                console.error('PPTX export failed:', err);
                alert('PPTX export failed: ' + (err && err.message ? err.message : err));
            }).then(reset);
        } catch (err) {
            console.error('PPTX export failed:', err);
            alert('PPTX export failed: ' + (err && err.message ? err.message : err));
            reset();
        }
    }
})();
