(() => {
    const KEY = 'advent-calendar-v2';
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
        const token = new URLSearchParams(location.hash.slice(1)).get('calendar');
        if (!token) return false;

        try {
            let stream = new Blob([base64UrlToBytes(token)]).stream();

            if ('DecompressionStream' in window) {
                stream = stream.pipeThrough(new DecompressionStream('gzip'));
            }

            const shared = JSON.parse(await new Response(stream).text());
            data = cleanCalendar(shared);
            storageKey = KEY + ':link:' + token.slice(0, 32);
            save();
            toast('Paylaşılan takvim açıldı.');
            return true;
        } catch {
            toast('Paylaşım bağlantısı geçersiz veya bozulmuş.');
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

            b.className = 'door' +
                (data.opened.includes(n) ? ' done' : '') +
                (day.photo ? ' has-photo' : '');
            b.type = 'button';
            b.setAttribute('aria-label', `${n}. gün${day.title ? ': ' + day.title : ''}`);

            if (day.photo) {
                b.style.setProperty('--photo', `url("${day.photo}")`);
            }

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

    $('shareBtn').addEventListener('click', async () => {
        try {
            if (!('CompressionStream' in window)) {
                throw Error('Bu tarayıcı paylaşım bağlantısını oluşturamıyor.');
            }

            const payload = {
                title: data.title,
                subtitle: data.subtitle,
                days: data.days
            };

            const compressed = new Blob([JSON.stringify(payload)])
                .stream()
                .pipeThrough(new CompressionStream('gzip'));

            const bytes = new Uint8Array(
                await new Response(compressed).arrayBuffer()
            );

            const url = new URL(location.href);
            url.hash = 'calendar=' + bytesToBase64Url(bytes);

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: data.title,
                        text: 'Angel Advent Calendar takvimi',
                        url: url.href
                    });
                    return;
                } catch (e) {
                    if (e.name === 'AbortError') return;
                }
            }

            try {
                await navigator.clipboard.writeText(url.href);
                toast('Paylaşım bağlantısı kopyalandı.');
            } catch {
                window.prompt('Takvim bağlantısını kopyala:', url.href);
            }
        } catch (e) {
            toast(e.message || 'Bağlantı oluşturulamadı.');
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

    try {
        const saved = JSON.parse(
            localStorage.getItem(storageKey) || localStorage.getItem(KEY)
        );

        if (saved && Array.isArray(saved.days) && saved.days.length === 24) {
            data = { ...data, ...saved };
        }
    } catch { }

    render();
    loadSharedCalendar().then(render);
})();