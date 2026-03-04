// ==UserScript==
// @name         dex-browser-enhancer: 为手机浏览器添加pc浏览器的功能
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  桌面增强套件：工具提示 | Shift文本选择 | 自定义滚动条 | 中键自动滚动 | 滚动缩放
// @author       Gemini
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================
       User Configuration (GLOBAL_CONFIG)
       用户自定义配置区
       ============================================ */
    const GLOBAL_CONFIG = {
        // Module 1: Tooltip Configuration
        // 模块1: 工具提示配置
        TOOLTIP: {
            delay: 1000,             // Tooltip display delay (ms) | 提示框显示延迟 (毫秒)
            fontSize: '13px',        // Font size | 字体大小
            backgroundColor: 'rgba(50, 50, 50, 0.9)', // Background color | 背景颜色
            textColor: '#ffffff',    // Text color | 文字颜色
            padding: '8px 12px',     // Padding | 内边距
            borderRadius: '6px',     // Border radius | 圆角
            maxWidth: '320px',       // Max width | 最大宽度
            offset: 15               // Tooltip offset from mouse | 提示框相对于鼠标的偏移量
        },

        // Module 3: Desktop Scrollbar Configuration
        // 模块3: 桌面样式滚动条配置
        SCROLL: {
            width: 12,               // Scrollbar width | 滚动条宽度
            arrowHeight: 20,         // Arrow height | 上下箭头高度
            stepSize: 100,           // Scroll step on arrow click | 点击箭头的滚动步长
            scrollSpeed: 15,         // Scroll speed on long press | 长按箭头的滚动速度
            longPressDelay: 500,     // Long press trigger delay (ms) | 长按触发延迟 (毫秒)
            zIndex: 99,          // Layer index | 层级
            color: 'rgba(128,128,128,0.5)', // Scrollbar color | 滚动条颜色
            hoverBg: 'rgba(128,128,128,0.1)', // Hover background color | 鼠标悬停背景色
            minThumb: 20,            // Min thumb height | 滑块最小高度
            skipSize: 100            // Container threshold (don't show if height < this) | 忽略过小容器的阈值
        },

        // Module 4: Middle Click Enhancement Configuration
        // 模块4: 中键增强配置
        MOUSE: {
            scrollSpeed: 1.5,        // Auto scroll speed multiplier | 自动滚动速度倍率
            deadZone: 7,             // Mouse movement dead zone (px) | 鼠标移动死区 (像素)
            indicatorColor: 'rgba(255, 0, 0, 0.4)', // Indicator color | 视觉指示点颜色
            indicatorSize: 10        // Indicator size | 视觉指示点大小
        },

        // Module 5: Wheel Zoom Configuration
        // 模块5: 滚轮缩放配置
        ZOOM: {
            step: 0.1,               // Zoom step (10%) | 缩放步进值 (10%)
            minScale: 0.3,           // Min scale (30%) | 最小缩放比例 (30%)
            maxScale: 5.0,           // Max scale (500%) | 最大缩放比例 (500%)
            indicatorDelay: 2000     // Indicator disappearance delay (ms) | 缩放提示框消失延迟 (毫秒)
        }
    };

    const siteId = location.host;
    const isDisabled = GM_getValue(`disabled_${siteId}`, false);

    // Language Detection | 语言检测
    const IS_CHINESE = navigator.language.startsWith('zh');
    const t = (zh, en) => IS_CHINESE ? zh : en;

    if (isDisabled) {
        GM_registerMenuCommand(t(`启用 ${siteId} 的增强功能`, `Enable enhanced features for ${siteId}`), () => {
            GM_setValue(`disabled_${siteId}`, false);
            location.reload();
        });
        return; // 禁用则不运行整个脚本
    }

    GM_registerMenuCommand(t(`禁用 ${siteId} 的增强功能`, `Disable enhanced features for ${siteId}`), () => {
        GM_setValue(`disabled_${siteId}`, true);
        location.reload();
    });

    /* ============================================
       模块1: 智能工具提示 (延迟显示版)
       ============================================ */
    (function TooltipModule() {
        const originalTitleDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'title');
        if (originalTitleDescriptor) {
            Object.defineProperty(HTMLElement.prototype, 'title', {
                get() {
                    // 如果存在自定义标题（说明已被接管），则返回自定义标题；否则调用原始 getter
                    return this.dataset.customTitle !== undefined ? this.dataset.customTitle : originalTitleDescriptor.get.call(this);
                },
                set(value) {
                    // 如果存在自定义标题（正在被接管），则同步更新自定义标题
                    if (this.dataset.customTitle !== undefined) {
                        this.dataset.customTitle = value;
                    } else {
                        // 否则按正常流程设置（如果元素还没被接管，依然会让它走原始 setter）
                        originalTitleDescriptor.set.call(this, value);
                    }
                },
                configurable: true,
                enumerable: true
            });
        }

        // 1. 创建自定义提示框元素
        const tooltip = document.createElement('div'); // 容器层
        const tooltipContent = document.createElement('div'); // 内容层
        tooltip.appendChild(tooltipContent);

        Object.assign(tooltip.style, {
            position: 'fixed',
            zIndex: '999999',
            padding: GLOBAL_CONFIG.TOOLTIP.padding,
            backgroundColor: GLOBAL_CONFIG.TOOLTIP.backgroundColor,
            color: GLOBAL_CONFIG.TOOLTIP.textColor,
            fontSize: GLOBAL_CONFIG.TOOLTIP.fontSize,
            borderRadius: GLOBAL_CONFIG.TOOLTIP.borderRadius,
            pointerEvents: 'none',
            visibility: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'opacity 0.2s ease',
            maxWidth: GLOBAL_CONFIG.TOOLTIP.maxWidth, // 包含 padding 的总宽度
            boxSizing: 'border-box'
        });

        Object.assign(tooltipContent.style, {
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: '5',
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-all'
        });

        document.documentElement.appendChild(tooltip);

        let hoverTimer = null; // 用于记录延迟的定时器
        let currentX = 0;      // 记录当前鼠标 X 坐标
        let currentY = 0;      // 记录当前鼠标 Y 坐标

        // 统一处理位置更新和边界检测的函数
        function updateTooltipPosition() {
            const offset = GLOBAL_CONFIG.TOOLTIP.offset;
            let x = currentX + offset;
            let y = currentY + offset;

            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // 右侧边界检查
            if (x + tooltipRect.width > viewportWidth) {
                x = currentX - tooltipRect.width - offset;
            }

            // 底部边界检查
            if (y + tooltipRect.height > viewportHeight) {
                y = currentY - tooltipRect.height - offset;
            }

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }

        // 2. 监听鼠标移入
        document.addEventListener('mouseover', (e) => {
            // 查找带有 title 属性，或者已经被我们接管了的元素 (不再局限于 'a' 标签)
            const target = e.target.closest('[title], [data-custom-title]');
            if (!target) return;

            // 立即接管并屏蔽原生 title，防止浏览器在 2 秒内弹出原生黑框
            if (target.hasAttribute('title')) {
                target.dataset.customTitle = target.getAttribute('title');
                target.removeAttribute('title');
            }

            const text = target.dataset.customTitle;
            if (!text) return;

            // 清除之前的定时器（防止快速滑动时触发多个）
            if (hoverTimer) clearTimeout(hoverTimer);

            // 设置延迟
            hoverTimer = setTimeout(() => {
                tooltipContent.textContent = text;
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
                // 文本内容填入后，计算宽高并更新位置
                updateTooltipPosition();
            }, GLOBAL_CONFIG.TOOLTIP.delay);
        });

        // 3. 监听鼠标移动
        document.addEventListener('mousemove', (e) => {
            // 实时更新鼠标坐标记录
            currentX = e.clientX;
            currentY = e.clientY;

            // 只有当提示框已经显示时，才让它跟随鼠标移动
            if (tooltip.style.visibility === 'visible') {
                updateTooltipPosition();
            }
        });

        // 4. 监听鼠标移出
        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[title], [data-custom-title]');
            if (target) {
                // 如果鼠标在 2 秒内移出，取消定时器，阻止提示框出现
                if (hoverTimer) clearTimeout(hoverTimer);

                // 隐藏提示框
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
            }
        });

        // 5. 点击时隐藏提示框
        document.addEventListener('mousedown', () => {
            if (hoverTimer) clearTimeout(hoverTimer);
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        });
    })();

    /* ============================================
       模块2: Shift文本选择
       ============================================ */
    (function KeyModule() {
        let selectionMode = false;
        let anchorIndex = -1;
        let currentIndex = -1;
        let activeElement = null;
        let activeElementType = null; // 'input' 或 'rte' (Rich Text Editor)

        // 综合判断元素类型：常规输入框还是富文本编辑器
        function getElementType(el) {
            if (!el) return null;
            const tagName = el.tagName.toLowerCase();

            // 常规文本框
            if (tagName === 'textarea') return 'input';
            if (tagName === 'input') {
                const type = el.type.toLowerCase();
                if (['text', 'search', 'url', 'tel', 'email', 'password'].includes(type)) return 'input';
            }

            // 现代富文本编辑器 (元素带有 contenteditable 属性)
            if (el.isContentEditable) return 'rte';

            // 老式/iframe版富文本编辑器 (整个文档开启了设计模式)
            if (el.ownerDocument && el.ownerDocument.designMode === 'on') return 'rte';

            return null;
        }

        // 退出选择模式统一处理
        function exitSelectionMode(el) {
            if (selectionMode && el) {
                selectionMode = false;
                el.style.outline = ''; // 移除高亮边框
                activeElementType = null;
            }
        }

        // 监听按键按下 (按下 Shift 进入模式)
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Shift' && !selectionMode) {
                const el = document.activeElement;
                const type = getElementType(el);

                if (type) {
                    // 进入选择模式
                    selectionMode = true;
                    activeElement = el;
                    activeElementType = type;

                    if (type === 'input') {
                        anchorIndex = el.selectionDirection === 'backward' ? el.selectionEnd : el.selectionStart;
                        currentIndex = el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd;
                    }

                    // el.style.outline = '2px dashed #007bff'; // 蓝色虚线视觉提示
                }
            }
        }, true);

        // 监听按键释放 (松开 Shift 退出模式)
        document.addEventListener('keyup', function (e) {
            if (e.key === 'Shift') {
                exitSelectionMode(activeElement);
            }
        }, true);

        // [Input 专用] 辅助函数：根据索引获取当前行号和列号
        function getLineCol(text, pos) {
            const before = text.substring(0, pos);
            const lines = before.split('\n');
            return { line: lines.length - 1, col: lines[lines.length - 1].length };
        }

        // [Input 专用] 辅助函数：根据行号和列号计算新光标位置
        function getPos(text, line, col) {
            const lines = text.split('\n');
            if (line < 0) return 0;
            if (line >= lines.length) return text.length;
            let pos = 0;
            for (let i = 0; i < line; i++) pos += lines[i].length + 1;
            return pos + Math.min(col, lines[line].length);
        }

        // 核心：拦截方向键并扩展选区
        document.addEventListener('keydown', function (e) {
            const el = document.activeElement;
            if (!selectionMode || el !== activeElement) return;

            const validKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            if (!validKeys.includes(e.key)) return;

            // 如果用户按了 Ctrl/Alt/Meta，交还给浏览器默认处理
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            e.preventDefault();

            if (activeElementType === 'input') {
                // === 常规文本框处理逻辑 ===
                const text = el.value;
                let newPos = currentIndex;
                const lineCol = getLineCol(text, currentIndex);

                switch (e.key) {
                    case 'ArrowLeft': newPos = Math.max(0, currentIndex - 1); break;
                    case 'ArrowRight': newPos = Math.min(text.length, currentIndex + 1); break;
                    case 'ArrowUp': newPos = getPos(text, lineCol.line - 1, lineCol.col); break;
                    case 'ArrowDown': newPos = getPos(text, lineCol.line + 1, lineCol.col); break;
                    case 'Home': newPos = getPos(text, lineCol.line, 0); break;
                    case 'End': newPos = getPos(text, lineCol.line, Infinity); break;
                }

                currentIndex = newPos;
                const start = Math.min(anchorIndex, currentIndex);
                const end = Math.max(anchorIndex, currentIndex);
                const direction = currentIndex < anchorIndex ? 'backward' : 'forward';
                el.setSelectionRange(start, end, direction);

            } else if (activeElementType === 'rte') {
                // === 富文本编辑器处理逻辑 (调用原生 Selection API) ===
                const sel = window.getSelection();
                if (!sel) return;

                // 使用 modify(alter, direction, granularity) 扩展选区
                switch (e.key) {
                    case 'ArrowLeft':
                        sel.modify('extend', 'backward', 'character');
                        break;
                    case 'ArrowRight':
                        sel.modify('extend', 'forward', 'character');
                        break;
                    case 'ArrowUp':
                        sel.modify('extend', 'backward', 'line');
                        break;
                    case 'ArrowDown':
                        sel.modify('extend', 'forward', 'line');
                        break;
                    case 'Home':
                        sel.modify('extend', 'backward', 'lineboundary');
                        break;
                    case 'End':
                        sel.modify('extend', 'forward', 'lineboundary');
                        break;
                }
            }
        }, true);

        // --- 自动退出机制 ---
        document.addEventListener('mousedown', function () { exitSelectionMode(activeElement); });
        document.addEventListener('blur', function (e) {
            if (e.target === activeElement) exitSelectionMode(activeElement);
        }, true);
        document.addEventListener('input', function (e) {
            if (e.target === activeElement) exitSelectionMode(activeElement);
        }, true);
    })();

    /* ============================================
       模块3: 全桌面样式滚动条 (带箭头)
       ============================================ */
    (function ScrollModule() {
        const CONFIG = GLOBAL_CONFIG.SCROLL;

        let processed = new WeakSet();

        // Clear processed on <a> click to allow re-scanning in SPAs
        document.addEventListener('click', (e) => {
            if (e.target.closest('a')) {
                processed = new WeakSet();
                throttledScan();
            }
        }, true);

        const instances = [];
        let rafPending = false;
        let scanTimer = null;

        const policy = window.trustedTypes && window.trustedTypes.createPolicy ?
            window.trustedTypes.createPolicy('gm-sb-policy', { createHTML: s => s }) :
            null;

        function throttledScan() {
            if (scanTimer) return;
            scanTimer = setTimeout(() => {
                scan();
                scheduleUpdate();
                scanTimer = null;
            }, 500);
        }

        function scheduleUpdate() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                for (let i = 0; i < instances.length; i++) instances[i].update();
                rafPending = false;
            });
        }

        function injectStyle() {
            if (document.getElementById('gm-sb-style')) return;
            const s = document.createElement('style');
            s.id = 'gm-sb-style';
            s.textContent = `
            .gm-no-sb { scrollbar-width: none !important; }
            .gm-no-sb::-webkit-scrollbar { display: none !important; }

            .gm-sb {
                position: fixed;
                width: ${CONFIG.width}px;
                z-index: ${CONFIG.zIndex};
                display: flex;
                flex-direction: column;
                user-select: none;
                touch-action: none;
                background: transparent;
                pointer-events: none;
                box-sizing: border-box;
            }
            .gm-sb .gm-sb-arr, .gm-sb .gm-sb-trk { pointer-events: auto; }
            .gm-sb .gm-sb-trk:hover { background: ${CONFIG.hoverBg}; }
            .gm-sb:hover .gm-sb-trk, .gm-sb:hover .gm-sb-arr { width: ${CONFIG.width}px; }

            .gm-sb-arr {
                height: ${CONFIG.arrowHeight}px;
                display: flex; visibility: hidden;
                align-items: center; justify-content: center;
                color: ${CONFIG.color}; cursor: default;
                width: ${CONFIG.width / 2}px;
                margin-left: auto;
                transition: width .2s;
            }
            .gm-sb:hover .gm-sb-arr { visibility: visible; }

            .gm-sb-trk {
                flex: 1; position: relative;
                width: ${CONFIG.width / 2}px;
                margin-left: auto;
                transition: width .2s;
            }

            .gm-sb-thb {
                position: absolute; width: 100%;
                background: ${CONFIG.color};
                border-radius: 10px;
            }
            .gm-sb-thb.active { background: rgba(100,100,100,.8); }
        `;
            document.head.appendChild(s);
        }

        function attachScrollbar(target) {
            const isWin = target === window;
            const el = isWin ? document.documentElement : target;

            if (processed.has(el)) return;
            // Skip if already has custom scrollbar or contains simplebar direct child
            if (!isWin && (el.classList.contains('gm-no-sb') || el.querySelector(':scope > [class*="simplebar"]'))) return;
            if (!isWin && (el === document.documentElement || el === document.body)) return;
            if (!isWin && el.clientHeight < CONFIG.skipSize) return;
            processed.add(el);


            // Create scrollbar DOM
            const ctr = document.createElement('div');
            ctr.className = 'gm-sb';

            const up = document.createElement('div');
            up.className = 'gm-sb-arr';
            const svgUp = '<svg viewBox="0 0 100 100"><path d="M50 20 L20 70 L80 70 Z" fill="currentColor"/></svg>';
            up.innerHTML = policy ? policy.createHTML(svgUp) : svgUp;

            const down = document.createElement('div');
            down.className = 'gm-sb-arr';
            const svgDown = '<svg viewBox="0 0 100 100"><path d="M50 80 L20 30 L80 30 Z" fill="currentColor"/></svg>';
            down.innerHTML = policy ? policy.createHTML(svgDown) : svgDown;

            const trk = document.createElement('div');
            trk.className = 'gm-sb-trk';
            const thb = document.createElement('div');
            thb.className = 'gm-sb-thb';

            trk.appendChild(thb);
            ctr.append(up, trk, down);
            document.documentElement.appendChild(ctr);

            // Hide native scrollbar
            if (isWin) {
                document.documentElement.classList.add('gm-no-sb');
                document.body.classList.add('gm-no-sb');
            } else {
                el.classList.add('gm-no-sb');
            }

            let isDrag = false, startY = 0, startScr = 0, trkH = 0;

            function getInfo() {
                if (isWin) {
                    const d = document.documentElement;
                    return { sH: d.scrollHeight, cH: window.innerHeight, sT: window.scrollY || d.scrollTop };
                }
                return { sH: el.scrollHeight, cH: el.clientHeight, sT: el.scrollTop };
            }

            function getRect() {
                if (isWin) return { top: 0, right: window.innerWidth, bottom: window.innerHeight, height: window.innerHeight };
                return el.getBoundingClientRect();
            }

            function doScroll(pos) {
                if (isWin) window.scrollTo({ top: pos, behavior: 'instant' });
                else el.scrollTop = pos;
            }

            function doScrollBy(d) {
                if (isWin) window.scrollBy({ top: d, behavior: 'instant' });
                else el.scrollTop += d;
            }

            function update() {
                if (!isWin && !el.isConnected) { ctr.style.display = 'none'; return; }
                const { sH, cH, sT } = getInfo();
                const r = getRect();

                // Visible rect clamped to viewport
                const vTop = Math.max(0, r.top);
                const vBot = Math.min(window.innerHeight, r.bottom);
                const vH = vBot - vTop;

                if (sH <= cH || vH <= 0) {
                    ctr.style.display = 'none';
                    return;
                }

                if (!isWin) {
                    const cs = getComputedStyle(el);
                    if (cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
                        ctr.style.display = 'none';
                        return;
                    }
                }

                ctr.style.display = 'flex';
                ctr.style.top = vTop + 'px';
                ctr.style.height = vH + 'px';
                ctr.style.right = (window.innerWidth - r.right) + 'px';

                trkH = trk.offsetHeight;
                let thumbH = Math.max(CONFIG.minThumb, (cH / sH) * trkH);

                const maxS = sH - cH;
                const ratio = maxS ? sT / maxS : 0;
                const thumbTop = (trkH - thumbH) * ratio;

                thb.style.height = thumbH + 'px';
                thb.style.transform = `translateY(${thumbTop}px)`;
            }

            // === Drag ===
            thb.addEventListener('pointerdown', e => {
                if (e.pointerType !== 'mouse') return;
                isDrag = true; thb.classList.add('active');
                startY = e.clientY; startScr = getInfo().sT;
                thb.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            thb.addEventListener('pointermove', e => {
                if (!isDrag) return;
                const { sH, cH } = getInfo();
                const movable = trkH - thb.offsetHeight;
                if (movable <= 0) return;
                doScroll(startScr + ((e.clientY - startY) / movable) * (sH - cH));
            });

            thb.addEventListener('pointerup', () => { isDrag = false; thb.classList.remove('active'); });

            // === Arrows ===
            let aT = null, aF = null;

            function startAuto(dir) {
                doScrollBy(dir * CONFIG.stepSize);
                aT = setTimeout(() => {
                    (function lp() { doScrollBy(dir * CONFIG.scrollSpeed); aF = requestAnimationFrame(lp); })();
                }, CONFIG.longPressDelay);
                document.addEventListener('pointerup', stopAuto, { once: true });
            }
            function stopAuto() { clearTimeout(aT); cancelAnimationFrame(aF); }

            up.addEventListener('pointerdown', e => { e.stopPropagation(); startAuto(-1); });
            down.addEventListener('pointerdown', e => { e.stopPropagation(); startAuto(1); });

            // === Track click ===
            trk.addEventListener('pointerdown', e => {
                if (e.target === thb) return;
                const tr = thb.getBoundingClientRect();
                doScrollBy((e.clientY > tr.bottom ? 1 : -1) * getInfo().cH * 0.9);
            });

            // === Wheel Scroll on Scrollbar ===
            ctr.addEventListener('wheel', e => {
                e.preventDefault();
                doScrollBy(e.deltaY);
            }, { passive: false });

            // === Observers ===
            (isWin ? window : el).addEventListener('scroll', scheduleUpdate, { passive: true });

            if (isWin) {
                new ResizeObserver(scheduleUpdate).observe(document.documentElement);
                new MutationObserver(scheduleUpdate).observe(document.documentElement, { childList: true, subtree: true });
            } else {
                new ResizeObserver(scheduleUpdate).observe(el);
            }

            instances.push({ update });
        }

        function scan() {
            // Apply to window first
            attachScrollbar(window);

            // Scan all elements for overflow/overflowY = auto|scroll
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (processed.has(el)) continue;
                const cs = getComputedStyle(el);
                const ov = cs.overflow;
                const ovY = cs.overflowY;
                if (ov === 'auto' || ov === 'scroll' || ovY === 'auto' || ovY === 'scroll') {
                    if (el.scrollHeight > el.clientHeight) {
                        attachScrollbar(el);
                    }
                }
            }
        }

        function waitForDOM() {
            if (!document.body || !document.head) { requestAnimationFrame(waitForDOM); return; }
            injectStyle();
            scan();

            const observer = new MutationObserver(throttledScan);
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                // attributeFilter: ['style', 'class']
            });
        }

        window.addEventListener('resize', scheduleUpdate);
        waitForDOM();
    })();

    /* ============================================
       模块4: 中键增强（超链接跳转 + 平滑自动滚动）
       ============================================ */
    (function MiddleMouseModule() {
        let isScrolling = false;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let animationId = null;
        let scrollTarget = null;
        const CONFIG = GLOBAL_CONFIG.MOUSE;
        let originalCursor = document.body.style.cursor;

        // 1. 监听中键按下
        window.addEventListener('mousedown', function (e) {
            if (e.button !== 1) return; // 只处理中键 (0:左, 1:中, 2:右)

            const target = e.composedPath()[0].closest('a');
            if (target && target.href) {
                // 如果是链接，不做拦截，让浏览器执行默认的新标签打开逻辑
                return;
            }

            // 屏蔽原生滚动模式
            e.preventDefault();
            e.stopPropagation();

            if (isScrolling) {
                stopAutoScroll();
            } else {
                startAutoScroll(e);
            }
        }, { capture: true, passive: false });

        function getScrollParent(el) {
            let parent = el;
            while (parent && parent !== document.body && parent !== document.documentElement) {
                const style = window.getComputedStyle(parent);
                const overflow = style.overflowY + style.overflowX + style.overflow;
                const canScrollY = parent.scrollHeight > parent.clientHeight;
                const canScrollX = parent.scrollWidth > parent.clientWidth;
                if (/(auto|scroll)/.test(overflow) && (canScrollY || canScrollX)) {
                    return parent;
                }
                parent = parent.parentElement;
            }
            return window;
        }

        function startAutoScroll(e) {
            isScrolling = true;
            startX = e.clientX;
            startY = e.clientY;
            currentX = e.clientX;
            currentY = e.clientY;
            scrollTarget = getScrollParent(e.target);

            // --- 核心修改：改变指针状态 ---
            originalCursor = document.body.style.cursor;
            document.body.style.setProperty('cursor', 'move', 'important');
            // 同时也给 html 标签加一下，确保即使鼠标不在 body 范围内也生效
            document.documentElement.style.setProperty('cursor', 'move', 'important');

            // 视觉指示点
            const indicator = document.createElement('div');
            indicator.id = 'scroll-indicator';
            indicator.style = `
            position: fixed; top: ${startY - CONFIG.indicatorSize / 2}px; left: ${startX - CONFIG.indicatorSize / 2}px;
            width: ${CONFIG.indicatorSize}px; height: ${CONFIG.indicatorSize}px; background: ${CONFIG.indicatorColor};
            border: 2px solid white; border-radius: 50%; z-index: 999999; pointer-events: none;
        `;
            document.documentElement.appendChild(indicator);

            window.addEventListener('mousemove', updatePosition);
            // 监听松开按键，校验距离
            window.addEventListener('mouseup', handleMouseUp, { capture: true, once: true });
            // 监听任意点击以取消
            window.addEventListener('mousedown', handleStopClick, { capture: true });

            animate();
        }

        function updatePosition(e) {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        function handleStopClick(e) {
            // 停止滚动逻辑
            stopAutoScroll();
        }

        function handleMouseUp(e) {
            if (!isScrolling) return;

            const distance = Math.sqrt(
                Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2)
            );

            if (distance > 25) {
                stopAutoScroll();
            }
        }

        function stopAutoScroll() {
            if (!isScrolling) return;
            isScrolling = false;

            cancelAnimationFrame(animationId);

            // --- 核心修改：恢复指针状态 ---
            document.body.style.cursor = originalCursor;
            document.documentElement.style.cursor = originalCursor;

            window.removeEventListener('mousemove', updatePosition);
            window.removeEventListener('mouseup', handleMouseUp, { capture: true });
            window.removeEventListener('mousedown', handleStopClick, { capture: true });

            const indicator = document.getElementById('scroll-indicator');
            if (indicator) indicator.remove();
            scrollTarget = null;
        }

        function animate() {
            if (!isScrolling) return;
            if (!scrollTarget) return;

            const diffX = currentX - startX;
            const diffY = currentY - startY;

            const scrollData = { behavior: 'instant' };
            let shouldScroll = false;

            // 15px 的死区，防止微小位移
            if (Math.abs(diffX) > CONFIG.deadZone) {
                scrollData.left = Math.sign(diffX) * Math.pow(Math.abs(diffX) / 12, 1.5) * CONFIG.scrollSpeed;
                shouldScroll = true;
            }
            if (Math.abs(diffY) > CONFIG.deadZone) {
                scrollData.top = Math.sign(diffY) * Math.pow(Math.abs(diffY) / 12, 1.5) * CONFIG.scrollSpeed;
                shouldScroll = true;
            }

            if (shouldScroll) {
                scrollTarget.scrollBy(scrollData);
            }

            animationId = requestAnimationFrame(animate);
        }
    })();

    /* ============================================
       模块5: 滚轮控制网页放大缩小
       ============================================ */
    (function ZoomModule() {
        const zoomKey = `zoom_${location.host}`;
        let currentZoom = GM_getValue(zoomKey, 1.0);
        let zoomTimer = null;

        // Panning state
        let isPanning = false;
        let startX = 0, startY = 0;
        let lastScrollX = 0, lastScrollY = 0;
        let hasMoved = false;
        let originalCursor = '';

        // Create indicator element
        const indicator = document.createElement('div');
        Object.assign(indicator.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 20px',
            background: 'rgba(0, 0, 0, 0.75)',
            color: 'white',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            zIndex: '999999',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.3s ease',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        });
        document.documentElement.appendChild(indicator);

        function showIndicator(zoom) {
            indicator.textContent = `${t('缩放', 'Zoom')}: ${Math.round(zoom * 100)}%`;
            indicator.style.opacity = '1';

            if (zoomTimer) clearTimeout(zoomTimer);
            zoomTimer = setTimeout(() => {
                indicator.style.opacity = '0';
            }, GLOBAL_CONFIG.ZOOM.indicatorDelay);
        }

        function applyZoom(zoom) {
            // Apply scale via transform
            document.body.style.transform = `scale(${zoom})`;
            document.body.style.transformOrigin = '0 0';

            // When zooming out (< 1), adjust body dimensions to fill the empty space
            if (zoom < 1) {
                const percentage = (100 / zoom).toFixed(2);
                document.body.style.width = `${percentage}%`;
                document.body.style.height = `${percentage}%`;
            } else {
                document.body.style.width = '';
                document.body.style.height = '';
            }

            window.dispatchEvent(new Event('resize'));
        }

        // Apply initial zoom
        if (currentZoom !== 1.0) {
            applyZoom(currentZoom);
        }

        // --- Zooming logic ---
        window.addEventListener('wheel', (e) => {
            if (!e.altKey) return;

            e.preventDefault();

            const oldZoom = currentZoom;
            const step = GLOBAL_CONFIG.ZOOM.step;

            if (e.deltaY < 0) {
                currentZoom += step;
            } else {
                currentZoom -= step;
            }

            currentZoom = Math.min(
                Math.max(GLOBAL_CONFIG.ZOOM.minScale, currentZoom),
                GLOBAL_CONFIG.ZOOM.maxScale
            );

            currentZoom = parseFloat(currentZoom.toFixed(2));

            if (currentZoom === oldZoom) return;

            // --- 关键部分 ---
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            const contentX = (scrollX + mouseX) / oldZoom;
            const contentY = (scrollY + mouseY) / oldZoom;

            applyZoom(currentZoom);

            const newScrollX = contentX * currentZoom - mouseX;
            const newScrollY = contentY * currentZoom - mouseY;

            window.scrollTo(newScrollX, newScrollY);

            GM_setValue(zoomKey, currentZoom);
            showIndicator(currentZoom);

        }, { passive: false });

        // --- Panning logic (Right Click Drag) ---
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right mouse button
                isPanning = true;
                startX = e.clientX;
                startY = e.clientY;
                lastScrollX = window.scrollX;
                lastScrollY = window.scrollY;
                hasMoved = false;
                originalCursor = document.body.style.cursor;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                // Move sensitivity
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    if (!hasMoved) {
                        document.body.style.setProperty('cursor', 'move', 'important');
                        document.documentElement.style.setProperty('cursor', 'move', 'important');
                    }
                    hasMoved = true;
                }

                if (hasMoved) {
                    window.scrollTo(lastScrollX - dx, lastScrollY - dy);
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                isPanning = false;
                if (hasMoved) {
                    document.body.style.cursor = originalCursor;
                    document.documentElement.style.cursor = originalCursor;
                }
            }
        });

        // Prevent context menu if we've dragged
        window.addEventListener('contextmenu', (e) => {
            if (hasMoved) {
                e.preventDefault();
                hasMoved = false;
            }
        });

    })();


})();
