(() => {
    const KEY = 'advent-calendar-v2';
    const SHARE_API = String(window.ADVENT_SHARE_API || '').replace(/\/+$/, '');
    const blankDay = () => ({
        type: 'Güzel bir not',
        title: 'Bugünün küçük sürprizi',
        text: 'Bu güne özel mesajını ekle ✨',
        photo: ''
    });

    let data = {
        title: 'Angel Advent Calendar',
        subtitle: '24 days of surprises and delights',
        days: Array.from({ length: 24 }, blankDay),
        opened: []
    };

    let storageKey = KEY + ':draft';
    let currentDay = 1;
    let editMode = false;
    let toastTimer;

    const $ = id => document.getElementById(id);
    const calendar = $('calendar');

    const save = () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
            toast('Kaydedilemedi. Fotoğrafları küçültüp tekrar dene.');
        }
    };

    const toast = message => {
        const el = $('toast');
        el.textContent = message;
        el.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.style.display = 'none', 3000);
    };

    const cleanCalendar = raw => {
        if (!raw || !Array.isArray(raw.days) || raw.days.length !== 24) {
            throw Error('Takvimde 24 gün bulunmalı.');
        }

        return {
            title: String(raw.title || 'Angel Advent Calendar').slice(0, 60),
            subtitle: String(raw.subtitle || '24 days of surprises and delights').slice(0, 140),
            days: raw.days.map(d => ({
                type: String(d.type || 'Günün sürprizi').slice(0, 40),
                title: String(d.title || '').slice(0, 70),
                text: String(d.text || '').slice(0, 1200),
                photo: typeof d.photo === 'string' && d.photo.startsWith('data:image/') ? d.photo : ''
            })),
            opened: []
        };
    };

    const bytesToBase64Url = bytes => {
        let binary = '';
        const chunk = 0x8000;

        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }

        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    };

    const base64UrlToBytes = value => {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
        return Uint8Array.from(binary, c => c.charCodeAt(0));
    };

    const loadSharedCalendar = async () => {
        const params = new URLSearchParams(location.hash.slice(1));
        const shareId = params.get('share');
        const legacyToken = params.get('calendar');
        if (!shareId && !legacyToken) return false;

        try {
            let shared;

            if (shareId) {
                const keyText = params.get('key');
                if (!SHARE_API || !keyText) throw Error('Paylaşılan takvim açılamadı.');

                const response = await fetch(`${SHARE_API}/api/shares/${encodeURIComponent(shareId)}`);
                if (!response.ok) throw Error(response.status === 404 ? 'Bu paylaşımın süresi dolmuş veya takvim bulunamadı.' : 'Takvim yüklenemedi. Tekrar dene.');
                const stored = await response.json();
                const packed = base64UrlToBytes(stored.ciphertext);
                const key = await crypto.subtle.importKey('raw', base64UrlToBytes(keyText), { name: 'AES-GCM' }, false, ['decrypt']);
                const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(0, 12) }, key, packed.slice(12));
                shared = JSON.parse(new TextDecoder().decode(clear));
                storageKey = KEY + ':link:' + shareId;
            } else {
                let stream = new Blob([base64UrlToBytes(legacyToken)]).stream();

                if ('DecompressionStream' in window) {
                    stream = stream.pipeThrough(new DecompressionStream('gzip'));
                }

                shared = JSON.parse(await new Response(stream).text());
                storageKey = KEY + ':link:' + legacyToken.slice(0, 32);
            }

            data = cleanCalendar(shared);
            save();
            if (shareId) toast('Paylaşılan takvim açıldı.');
            return true;
        } catch (error) {
            toast(error.message || 'Paylaşım bağlantısı geçersiz veya bozulmuş.');
            return false;
        }
    };

    const render = () => {
        $('calendarTitle').textContent = data.title || 'Angel Advent Calendar';
        $('calendarSubtitle').textContent = data.subtitle || '24 days of surprises and delights';
        calendar.replaceChildren();

        data.days.forEach((day, index) => {
            const n = index + 1;
            const b = document.createElement('button');

            b.className = 'door' + (data.opened.includes(n) ? ' done' : '');
            b.type = 'button';
            b.setAttribute('aria-label', `${n}. gün${day.title ? ': ' + day.title : ''}`);

            b.innerHTML = `<span class="num">${n}</span>`;
            b.addEventListener('click', () => {
                currentDay = n;
                if (editMode) openEditor();
                else openDay();
            });

            calendar.append(b);
        });

        $('editMode').textContent = editMode ? 'Düzenlemeyi bitir' : 'Düzenle';
        $('editMode').classList.toggle('is-active', editMode);
    };

    const openDay = () => {
        const d = data.days[currentDay - 1];
        $('dayType').textContent = d.type || 'Günün sürprizi';
        $('dayTitle').textContent = d.title || `${currentDay}. Gün`;
        $('dayText').textContent = d.text || '';

        const img = $('dayPhoto');

        if (d.photo) {
            img.src = d.photo;
            img.style.display = 'block';
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
        }

        data.opened = [...new Set([...data.opened, currentDay])];
        save();
        render();
        $('dayDialog').showModal();
    };

    const openEditor = () => {
        $('editHeading').textContent = `${currentDay}. günü düzenle`;
        $('titleInput').value = data.title;
        $('subtitleInput').value = data.subtitle;

        const d = data.days[currentDay - 1];
        $('typeInput').value = d.type || 'Güzel bir not';
        $('dayTitleInput').value = d.title || '';
        $('dayTextInput').value = d.text || '';
        $('photoInput').value = '';
        $('editDialog').showModal();
    };

    const compressImage = file => new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(Error('Lütfen bir fotoğraf seç.'));
        }

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');

            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', .72));
        };

        img.onerror = () => reject(Error('Fotoğraf açılamadı.'));
        img.src = url;
    });

    $('editMode').addEventListener('click', () => {
        editMode = !editMode;
        render();
        toast(editMode ? 'Bir güne dokunup düzenleyebilirsin.' : 'Düzenleme kapatıldı.');
    });

    $('editForm').addEventListener('submit', async e => {
        e.preventDefault();

        const file = $('photoInput').files[0];
        let photo = data.days[currentDay - 1].photo;

        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast('Fotoğraf en fazla 10 MB olabilir.');
                return;
            }

            try {
                photo = await compressImage(file);
            } catch (err) {
                toast(err.message);
                return;
            }
        }

        data.title = $('titleInput').value.trim() || 'Angel Advent Calendar';
        data.subtitle = $('subtitleInput').value.trim() || '24 days of surprises and delights';
        data.days[currentDay - 1] = {
            type: $('typeInput').value,
            title: $('dayTitleInput').value.trim() || `${currentDay}. Gün`,
            text: $('dayTextInput').value.trim(),
            photo
        };

        save();
        render();
        $('editDialog').close();
        toast('Günün sürprizi kaydedildi.');
    });

    $('removePhoto').addEventListener('click', () => {
        $('photoInput').value = '';
        data.days[currentDay - 1].photo = '';
        save();
        toast('Fotoğraf kaldırıldı. Kaydet’e basınca değişiklik tamamlanır.');
    });

    $('importBtn').addEventListener('click', () => $('fileInput').click());

    $('fileInput').addEventListener('change', async e => {
        const f = e.target.files[0];
        if (!f) return;

        try {
            data = cleanCalendar(JSON.parse(await f.text()));
            save();
            render();
            toast('Takvim içe aktarıldı.');
        } catch {
            toast('Bu dosya geçerli bir Advent takvimi değil.');
        }

        e.target.value = '';
    });

    const makeLegacyShareUrl = async () => {
        if (!('CompressionStream' in window)) {
            throw Error('Bu tarayıcı paylaşım bağlantısı oluşturamıyor.');
        }

        const payload = { title: data.title, subtitle: data.subtitle, days: data.days };
        const compressed = new Blob([JSON.stringify(payload)])
            .stream()
            .pipeThrough(new CompressionStream('gzip'));
        const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
        const url = new URL(location.pathname, location.origin);
        url.hash = 'calendar=' + bytesToBase64Url(bytes);
        return url.href;
    };

    const makeEncryptedShareUrl = async () => {
        if (!SHARE_API) return { url: await makeLegacyShareUrl(), legacy: true };
        if (!crypto.subtle) throw Error('Güvenli paylaşım için HTTPS gerekir.');

        const payload = JSON.stringify({ title: data.title, subtitle: data.subtitle, days: data.days });
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
        const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = new Uint8Array(await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(payload)
        ));
        const packed = new Uint8Array(iv.length + encrypted.length);
        packed.set(iv, 0);
        packed.set(encrypted, iv.length);
        const ciphertext = bytesToBase64Url(packed);

        const response = await fetch(`${SHARE_API}/api/shares`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ciphertext })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw Error(result.error === 'Calendar is too large.'
                ? 'Takvim dosyası büyük. Fotoğrafları küçültüp tekrar dene.'
                : 'Kısa bağlantı oluşturulamadı. Worker kurulumunu kontrol et.');
        }

        const url = new URL(location.pathname, location.origin);
        url.hash = new URLSearchParams({ share: result.id, key: bytesToBase64Url(rawKey) }).toString();
        return { url: url.href, legacy: false };
    };

    const showShareDialog = async () => {
        const button = $('shareBtn');
        button.disabled = true;
        $('shareNote').textContent = 'Güvenli bağlantı hazırlanıyor…';

        try {
            const result = await makeEncryptedShareUrl();
            $('shareUrl').value = result.url;
            $('shareQr').replaceChildren();
            $('downloadQr').disabled = true;

            if (result.legacy) {
                $('shareNote').textContent = 'Kısa bağlantı sunucusu henüz bağlanmadı. Bu geçici bağlantı uzun olabilir; ayar tamamlanınca kısa link ve QR kullanılabilir.';
            } else {
                $('shareNote').textContent = 'Takvim tarayıcıda şifrelendi. Bağlantıya sahip olan kişiler açabilir; linki yalnızca paylaşmak istediğin kişiye gönder.';
            }

            try {
                new QRCode($('shareQr'), {
                    text: result.url,
                    width: 240,
                    height: 240,
                    correctLevel: QRCode.CorrectLevel.M
                });
                $('downloadQr').disabled = false;
            } catch {
                $('shareNote').textContent += ' QR üretilemedi; bağlantı fazla uzun olabilir.';
            }

            $('shareDialog').showModal();
        } catch (error) {
            toast(error.message || 'Bağlantı oluşturulamadı.');
        } finally {
            button.disabled = false;
        }
    };

    $('shareBtn').addEventListener('click', showShareDialog);

    $('copyShareLink').addEventListener('click', async () => {
        const input = $('shareUrl');
        try {
            await navigator.clipboard.writeText(input.value);
            toast('Bağlantı kopyalandı.');
        } catch {
            input.focus();
            input.select();
            const copied = document.execCommand('copy');
            toast(copied ? 'Bağlantı kopyalandı.' : 'Bağlantıyı seçip kopyalayabilirsin.');
        }
    });

    $('downloadQr').addEventListener('click', () => {
        const canvas = $('shareQr').querySelector('canvas');
        if (!canvas) return toast('Önce QR kodu oluştur.');
        const link = document.createElement('a');
        link.download = 'angel-advent-calendar-qr.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    $('nativeShare').addEventListener('click', async () => {
        const url = $('shareUrl').value;
        try {
            if (navigator.share) {
                await navigator.share({ title: data.title, text: 'Angel Advent Calendar takvimi', url });
            } else {
                await navigator.clipboard.writeText(url);
                toast('Bağlantı kopyalandı.');
            }
        } catch (error) {
            if (error.name !== 'AbortError') toast('Paylaşım açılamadı.');
        }
    });

    $('editDay').addEventListener('click', () => {
        $('dayDialog').close();
        editMode = true;
        render();
        openEditor();
    });

    document.querySelectorAll('[data-close]').forEach(b => {
        b.addEventListener('click', () => b.closest('dialog').close());
    });

    document.querySelectorAll('dialog').forEach(d => {
        d.addEventListener('click', e => {
            if (e.target === d) d.close();
        });
    });

    const initialShare = new URLSearchParams(location.hash.slice(1)).get('share');
    if (initialShare) storageKey = KEY + ':link:' + initialShare;

    try {
        const saved = JSON.parse(
            localStorage.getItem(storageKey) || (!initialShare ? localStorage.getItem(KEY) : null)
        );

        if (saved && Array.isArray(saved.days) && saved.days.length === 24) {
            data = { ...data, ...saved };
        }
    } catch { }

    render();
    loadSharedCalendar().then(render);
})();