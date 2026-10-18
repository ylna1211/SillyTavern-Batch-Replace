const MODULE_NAME = 'st_batch_text_replace';
const EXTENSION_ID = 'st-batch-text-replace';

function notify(message, type = 'info') {
    if (window.toastr?.[type]) {
        window.toastr[type](message, '批次文字取代');
    } else {
        alert(message);
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[ch]);
}

function getContext() {
    if (!window.SillyTavern?.getContext) {
        throw new Error('找不到 SillyTavern.getContext()。请确认 SillyTavern 版本并重新载入页面。');
    }
    return window.SillyTavern.getContext();
}

function downloadBackup(chat, context) {
    const payload = {
        backup_type: 'SillyTavern Batch Text Replace backup',
        created_at: new Date().toISOString(),
        note: '这是修改前目前聊天消息数组的 JSON 备份，不是原始 JSONL 文件的逐字节复制。',
        character_name: context.name2 ?? context.characterName ?? null,
        chat_id: context.chatId ?? context.chat_id ?? null,
        messages: structuredClone(chat),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `SillyTavern-chat-backup-before-replace-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function findMatches(chat, findText) {
    const results = [];
    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message || typeof message.mes !== 'string') continue;
        let count = 0;
        let from = 0;
        while (true) {
            const at = message.mes.indexOf(findText, from);
            if (at === -1) break;
            count++;
            from = at + findText.length;
        }
        if (count > 0) {
            results.push({
                index: i,
                count,
                speaker: message.is_user ? '用户' : (message.name || '角色／系统'),
                excerpt: message.mes.slice(0, 180),
            });
        }
    }
    return results;
}

function buildPanel() {
    const html = `
    <section id="${EXTENSION_ID}" class="stbr-panel">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>批次文字取代</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <p class="stbr-note">只修改当前聊天中消息的文字字段（mes），不修改发言者名称或其他元数据。</p>
          <label for="stbr-find">查找文字</label>
          <input id="stbr-find" type="text" class="text_pole" autocomplete="off" placeholder="例如：艾莉丝丝">
          <label for="stbr-replace">替换为</label>
          <input id="stbr-replace" type="text" class="text_pole" autocomplete="off" placeholder="例如：艾莉丝">
          <label class="stbr-checkbox-label" for="stbr-autobackup">
            <input id="stbr-autobackup" type="checkbox" checked>
            执行前自动下载 JSON 备份
          </label>
          <div class="stbr-actions">
            <button id="stbr-preview" class="menu_button">预览</button>
            <button id="stbr-apply" class="menu_button" disabled>全部替换</button>
          </div>
          <div id="stbr-status" class="stbr-status" role="status">请先输入要查找的文字。</div>
          <div id="stbr-results" class="stbr-results"></div>
          <p class="stbr-warning">若勾选自动备份，执行时会先下载修改前的 JSON 备份，再写入聊天。请确认浏览器允许下载文件。此备份是消息数据备份，不是原始聊天文件的逐字节副本。</p>
        </div>
      </div>
    </section>`;
    $('#extensions_settings2').append(html);

    let lastFind = '';
    let lastReplace = '';
    let lastMatches = [];

    const $find = $('#stbr-find');
    const $replace = $('#stbr-replace');
    const $autoBackup = $('#stbr-autobackup');
    const $preview = $('#stbr-preview');
    const $apply = $('#stbr-apply');
    const $status = $('#stbr-status');
    const $results = $('#stbr-results');

    function clearPreview() {
        lastFind = '';
        lastReplace = '';
        lastMatches = [];
        $apply.prop('disabled', true);
        $results.empty();
    }

    $find.add($replace).on('input', clearPreview);

    $preview.on('click', () => {
        try {
            const findText = $find.val();
            const replaceText = $replace.val();
            if (!findText) {
                clearPreview();
                $status.text('“查找文字”不可空白。');
                return;
            }
            if (findText === replaceText) {
                clearPreview();
                $status.text('查找文字与替换文字相同，没有需要修改的内容。');
                return;
            }
            const context = getContext();
            const chat = context.chat;
            if (!Array.isArray(chat) || chat.length === 0) {
                clearPreview();
                $status.text('当前没有可处理的聊天消息。');
                return;
            }

            lastMatches = findMatches(chat, findText);
            lastFind = findText;
            lastReplace = replaceText;

            const total = lastMatches.reduce((sum, item) => sum + item.count, 0);
            $status.text(`找到 ${total} 处，分布于 ${lastMatches.length} 条消息。请检查下方预览。`);
            $results.empty();

            if (lastMatches.length) {
                const list = $('<ol class="stbr-list"></ol>');
                for (const item of lastMatches.slice(0, 30)) {
                    const excerpt = item.excerpt.includes(findText)
                        ? item.excerpt.replaceAll(findText, `【${findText}】`)
                        : item.excerpt;
                    const row = $('<li></li>');
                    row.append($('<div class="stbr-result-head"></div>').text(
                        `第 ${item.index + 1} 条 · ${item.speaker} · ${item.count} 处`
                    ));
                    row.append($('<div class="stbr-excerpt"></div>').text(excerpt));
                    list.append(row);
                }
                $results.append(list);
                if (lastMatches.length > 30) {
                    $results.append($('<p></p>').text(`仅显示前 30 条；实际共 ${lastMatches.length} 条。`));
                }
                $apply.prop('disabled', false);
            } else {
                $results.text('没有找到符合的文字。');
                $apply.prop('disabled', true);
            }
        } catch (error) {
            clearPreview();
            $status.text(`预览失败：${error.message}`);
            console.error(`[${MODULE_NAME}] preview failed`, error);
        }
    });

    $apply.on('click', async () => {
        if (!lastFind || lastFind !== $find.val() || lastReplace !== $replace.val() || !lastMatches.length) {
            $status.text('预览已失效，请重新预览。');
            $apply.prop('disabled', true);
            return;
        }

        const autoBackup = $autoBackup.prop('checked');
        const total = lastMatches.reduce((sum, item) => sum + item.count, 0);
        const confirmed = window.confirm(
            `即将替换当前聊天中的 ${total} 处文字（${lastMatches.length} 条消息）。\n\n` +
            `查找：${lastFind}\n替换为：${lastReplace}\n\n` +
            (autoBackup ? '程序会先下载修改前的 JSON 备份。' : '未勾选自动备份，不会下载备份文件。') +
            '确定继续？'
        );
        if (!confirmed) return;

        $apply.prop('disabled', true);
        $preview.prop('disabled', true);
        $status.text(autoBackup ? '正在备份并修改……' : '正在修改……');

        let changed = [];
        try {
            const context = getContext();
            const chat = context.chat;
            if (!Array.isArray(chat)) throw new Error('当前聊天数据不可用。');

            // Re-check the preview against current chat to avoid applying stale results.
            const currentMatches = findMatches(chat, lastFind);
            const currentTotal = currentMatches.reduce((sum, item) => sum + item.count, 0);
            const expectedTotal = lastMatches.reduce((sum, item) => sum + item.count, 0);
            if (currentTotal !== expectedTotal ||
                currentMatches.map(x => `${x.index}:${x.count}`).join('|') !==
                lastMatches.map(x => `${x.index}:${x.count}`).join('|')) {
                throw new Error('聊天内容在预览后发生变化。未修改任何内容，请重新预览。');
            }

            // Backup (optional) must be initiated before mutating the live chat array.
            if (autoBackup) {
                downloadBackup(chat, context);
            }

            for (const item of currentMatches) {
                const message = chat[item.index];
                changed.push({ message, original: message.mes });
                message.mes = message.mes.split(lastFind).join(lastReplace);
            }

            if (typeof context.saveChat !== 'function') {
                // Roll back rather than leaving in-memory edits unsaved.
                for (const item of changed) item.message.mes = item.original;
                changed = [];
                throw new Error('此版本未在 getContext() 提供 saveChat()。已取消修改' +
                    (autoBackup ? '；备份文件仍已下载。' : '。'));
            }

            await context.saveChat();

            // Re-render via the supported context function when present.
            if (typeof context.reloadCurrentChat === 'function') {
                await context.reloadCurrentChat();
            } else if (context.eventSource && context.event_types?.CHAT_CHANGED) {
                // A CHAT_CHANGED event may refresh listeners; avoid relying on it as the only persistence method.
                context.eventSource.emit(context.event_types.CHAT_CHANGED);
            }

            $status.text(`完成：已替换 ${total} 处，修改 ${changed.length} 条消息。` +
                (autoBackup ? '修改前备份已下载。' : '未下载备份。'));
            $results.empty();
            clearPreview();
            notify(`已替换 ${total} 处文字。`, 'success');
        } catch (error) {
            // If save failed after mutation, restore the in-memory message text.
            for (const item of changed) item.message.mes = item.original;
            try {
                const context = getContext();
                if (typeof context.saveChat === 'function' && changed.length) {
                    await context.saveChat();
                }
            } catch (rollbackError) {
                console.error(`[${MODULE_NAME}] rollback save failed`, rollbackError);
            }
            $status.text(`操作未完成：${error.message}\n若已下载备份，请保留该文件。`);
            notify(error.message, 'error');
            console.error(`[${MODULE_NAME}] replace failed`, error);
        } finally {
            $preview.prop('disabled', false);
            $apply.prop('disabled', false);
        }
    });
}

function init() {
    if (!window.jQuery) {
        console.error(`[${MODULE_NAME}] jQuery not found; extension UI was not initialized.`);
        return;
    }
    if ($('#' + EXTENSION_ID).length) return;
    buildPanel();
    console.log(`[${MODULE_NAME}] loaded`);
}

if (window.SillyTavern?.getContext) {
    const context = window.SillyTavern.getContext();
    if (context.eventSource && context.event_types?.APP_READY) {
        context.eventSource.on(context.event_types.APP_READY, init);
    }
    // Fallback for versions where APP_READY has already fired before this extension runs.
    setTimeout(init, 1500);
} else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500), { once: true });
                     }
