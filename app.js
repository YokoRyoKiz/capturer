document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const workspace = document.getElementById('workspace');
    const videoInput = document.getElementById('video-input');
    const videoInputChange = document.getElementById('video-input-change');
    const videoPlayer = document.getElementById('video-player');
    
    const badgeResolution = document.getElementById('badge-resolution');
    const badgeFps = document.getElementById('badge-fps');
    
    const seekBar = document.getElementById('seek-bar');
    const seekProgress = document.getElementById('seek-progress');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');
    
    const btnPlay = document.getElementById('btn-play');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const btnStepBack = document.getElementById('btn-step-back');
    const btnStepForward = document.getElementById('btn-step-forward');
    const btnStepBackFast = document.getElementById('btn-step-back-fast');
    const btnStepForwardFast = document.getElementById('btn-step-forward-fast');
    const stepIntervalSelect = document.getElementById('step-interval');
    
    const btnCapture = document.getElementById('btn-capture');
    const galleryGrid = document.getElementById('gallery-grid');
    const galleryCount = document.getElementById('gallery-count');
    const btnClearGallery = document.getElementById('btn-clear-gallery');
    const toast = document.getElementById('toast');

    // App State
    let videoFile = null;
    let videoFileName = 'video';
    let captures = [];

    // --- File Drag & Drop & Upload Handling ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0 && files[0].type.startsWith('video/')) {
            loadVideoFile(files[0]);
        } else {
            showToast('有効な動画ファイルを選択してください。');
        }
    });

    videoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadVideoFile(e.target.files[0]);
        }
    });

    videoInputChange.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadVideoFile(e.target.files[0]);
        }
    });

    function loadVideoFile(file) {
        videoFile = file;
        videoFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        
        dropZone.classList.add('hidden');
        workspace.classList.remove('hidden');

        showToast(`「${file.name}」を読み込みました`);
    }

    // --- Video Events & Meta ---
    videoPlayer.addEventListener('loadedmetadata', () => {
        const width = videoPlayer.videoWidth;
        const height = videoPlayer.videoHeight;
        const duration = videoPlayer.duration;

        badgeResolution.textContent = `${width} × ${height}`;
        timeDuration.textContent = formatTime(duration);
        timeCurrent.textContent = formatTime(0);

        seekBar.max = duration;
        seekBar.value = 0;
        updateSeekProgress();

        // 停止状態で準備
        videoPlayer.pause();
        updatePlayStateUI();
    });

    videoPlayer.addEventListener('timeupdate', () => {
        if (!isSeeking) {
            seekBar.value = videoPlayer.currentTime;
            updateSeekProgress();
        }
        timeCurrent.textContent = formatTime(videoPlayer.currentTime);
    });

    videoPlayer.addEventListener('ended', () => {
        updatePlayStateUI();
    });

    // --- Time Seek Bar Handling ---
    let isSeeking = false;

    seekBar.addEventListener('input', () => {
        isSeeking = true;
        videoPlayer.currentTime = parseFloat(seekBar.value);
        timeCurrent.textContent = formatTime(videoPlayer.currentTime);
        updateSeekProgress();
    });

    seekBar.addEventListener('change', () => {
        isSeeking = false;
        videoPlayer.currentTime = parseFloat(seekBar.value);
    });

    function updateSeekProgress() {
        if (videoPlayer.duration) {
            const percent = (seekBar.value / videoPlayer.duration) * 100;
            seekProgress.style.width = `${percent}%`;
        }
    }

    // --- Play / Pause & Step Controls ---
    btnPlay.addEventListener('click', togglePlay);

    function togglePlay() {
        if (videoPlayer.paused || videoPlayer.ended) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
        updatePlayStateUI();
    }

    function updatePlayStateUI() {
        if (videoPlayer.paused || videoPlayer.ended) {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        } else {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        }
    }

    function getStepInterval() {
        return parseFloat(stepIntervalSelect.value);
    }

    function stepVideo(seconds) {
        videoPlayer.pause();
        updatePlayStateUI();
        let targetTime = videoPlayer.currentTime + seconds;
        targetTime = Math.max(0, Math.min(videoPlayer.duration, targetTime));
        videoPlayer.currentTime = targetTime;
    }

    btnStepBack.addEventListener('click', () => stepVideo(-getStepInterval()));
    btnStepForward.addEventListener('click', () => stepVideo(getStepInterval()));
    btnStepBackFast.addEventListener('click', () => stepVideo(-1.0));
    btnStepForwardFast.addEventListener('click', () => stepVideo(1.0));

    // --- Keyboard Shortcut Handling ---
    document.addEventListener('keydown', (e) => {
        // テキスト入力中などはショートカットを無視
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            // Seek bar itself should still work smoothly without double triggering
            if (document.activeElement === seekBar) {
                // let default behavior happen for seekbar or handle specially
            } else {
                return;
            }
        }

        if (workspace.classList.contains('hidden')) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                stepVideo(e.shiftKey ? -1.0 : -getStepInterval());
                break;
            case 'ArrowRight':
                e.preventDefault();
                stepVideo(e.shiftKey ? 1.0 : getStepInterval());
                break;
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'Enter':
            case 'c':
            case 'C':
                e.preventDefault();
                captureFrame();
                break;
        }
    });

    // --- PNG Capture & Highest Resolution Export ---
    btnCapture.addEventListener('click', captureFrame);

    function captureFrame() {
        if (!videoPlayer.videoWidth || !videoPlayer.videoHeight) {
            showToast('動画が正常に読み込まれていません。');
            return;
        }

        // 一時停止して最高精度で取得
        const isPaused = videoPlayer.paused;
        videoPlayer.pause();
        updatePlayStateUI();

        const canvas = document.createElement('canvas');
        canvas.width = videoPlayer.videoWidth;
        canvas.height = videoPlayer.videoHeight;

        const ctx = canvas.getContext('2d');
        // 最高画質描画設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);

        const currentTimeVal = videoPlayer.currentTime;
        const timeFormatted = formatTimeFilename(currentTimeVal);
        const fileName = `${videoFileName}_${timeFormatted}_${canvas.width}x${canvas.height}.png`;

        canvas.toBlob((blob) => {
            if (!blob) {
                showToast('キャプチャに失敗しました。');
                return;
            }
            const blobUrl = URL.createObjectURL(blob);
            
            const captureData = {
                id: Date.now(),
                url: blobUrl,
                fileName: fileName,
                timeStr: formatTime(currentTimeVal),
                width: canvas.width,
                height: canvas.height
            };

            captures.unshift(captureData);
            renderGallery();
            showToast(`最高画質PNGを切り出しました (${canvas.width}x${canvas.height})`);

        }, 'image/png', 1.0);
    }

    // --- Gallery Render ---
    function renderGallery() {
        galleryCount.textContent = captures.length;
        if (captures.length > 0) {
            btnClearGallery.style.display = 'inline-flex';
        } else {
            btnClearGallery.style.display = 'none';
        }

        if (captures.length === 0) {
            galleryGrid.innerHTML = `
                <div class="empty-gallery-msg">
                    「PNG化」ボタンを押すと、元解像度の切り出し画像がここに保存・表示されます。
                </div>
            `;
            return;
        }

        galleryGrid.innerHTML = captures.map(item => `
            <div class="gallery-card" data-id="${item.id}">
                <div class="gallery-img-wrapper">
                    <img src="${item.url}" alt="${item.fileName}">
                </div>
                <div class="gallery-card-info">
                    <div class="gallery-card-meta">
                        <span class="gallery-time">⏱ ${item.timeStr}</span>
                        <span>${item.width} × ${item.height}</span>
                    </div>
                    <div class="gallery-card-actions">
                        <a href="${item.url}" download="${item.fileName}" class="btn btn-primary btn-sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            保存
                        </a>
                        <button class="btn btn-ghost btn-sm btn-delete-capture" data-id="${item.id}">削除</button>
                    </div>
                </div>
            </div>
        `).join('');

        // Event listener for delete buttons
        document.querySelectorAll('.btn-delete-capture').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                captures = captures.filter(c => c.id !== id);
                renderGallery();
            });
        });
    }

    btnClearGallery.addEventListener('click', () => {
        captures = [];
        renderGallery();
        showToast('ギャラリーをクリアしました。');
    });

    // --- Helper Functions ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00:00.000";
        
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.floor((seconds % 1) * 1000);

        const pad = (num, size = 2) => String(num).padStart(size, '0');

        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
    }

    function formatTimeFilename(seconds) {
        if (isNaN(seconds)) return "00-00-00.000";
        
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.floor((seconds % 1) * 1000);

        const pad = (num, size = 2) => String(num).padStart(size, '0');

        return `${pad(hrs)}-${pad(mins)}-${pad(secs)}.${pad(millis, 3)}`;
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
