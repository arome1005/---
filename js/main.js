// FileName: iReader:main.js
// Update: 2025/12/5 19:41
// Copyright (c) 2025.

const DEFAULT_BOOK_KEY = 'NCE1(85)';
const PLAY_MODE_STORAGE_KEY = 'playMode';
const BOOK_SELECTION_STORAGE_KEY = 'selectedBookKey';

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));


class ReadingSystem {
  constructor() {
    this.state = {
      books: [],
      units: [],
      bookPath: '',
      bookKey: '',
      currentLyrics: [],
      currentLyricIndex: -1,
      currentUnitIndex: -1,
      playMode: 'single',
      singlePlayEndTime: null,
      playbackRate: 1.0,
      translationMode: 'show',
      availableSpeeds: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
      savedPlayTime: 0,
      isProgressDragging: false,
      teacher: 'textbook',
      shirleyVideos: [],
      frankVideos: [],
      localFiles: [],
      directoryHandle: null,
      rootFolderName: null,
      fontSize: 18,
      currentVideoName: null,
      teacher: 'textbook'
    };

    this.dom = {
      audioPlayer: qs('#audioPlayer'),
      mainVideo: qs('#mainVideo'),
      videoFloatingWindow: qs('#videoFloatingWindow'),
      videoHeader: qs('#videoHeader'),
      videoTitle: qs('#videoTitle'),
      closeVideoBtn: qs('#closeVideoBtn'),
      toggleExerciseBtn: qs('#toggleExerciseBtn'),
      togglePlaylistBtn: qs('#togglePlaylistBtn'),
      videoPlaylist: qs('#videoPlaylist'),
      playlistItems: qs('#playlistItems'),
      linkLocalFolder: qs('#linkLocalFolder'),
      linkFolderText: qs('#linkFolderText'),
      localFolderInput: qs('#localFolderInput'),
      fontFamilySelect: qs('#fontFamilySelect'),
      increaseFontSize: qs('#increaseFontSize'),
      decreaseFontSize: qs('#decreaseFontSize'),
      lyricsDisplay: qs('#lyricsDisplay'),
      lyricsContainer: qs('.lyrics-container'),
      catalogContainer: qs('#catalogContainer'),
      catalogTitle: qs('#catalogTitle'),
      catalogCount: qs('#catalogCount'),
      catalogGrid: qs('#catalogGrid'),
      bookName: qs('#bookName'),
      bookLevel: qs('#bookLevel'),
      playModeBtn: qs('#playModeBtn'),
      playPauseBtn: qs('#playPauseBtn'),
      progressBar: qs('#progressBar'),
      currentTime: qs('#currentTime'),
      duration: qs('#duration'),
      speedBtn: qs('#speedBtn'),
      speedText: qs('#speedText'),
      bookCover: qs('#bookCover'),
      courseTree: qs('#courseTree'),
      prevUnitBtn: qs('#prevUnitBtn'),
      nextUnitBtn: qs('#nextUnitBtn'),
      toggleTranslationBtn: qs('#toggleTranslationBtn'),
      aiExplainBtn: qs('#aiExplainBtn'),
      aiModal: qs('#aiModal'),
      aiContent: qs('#aiContent'),
      closeAiModal: qs('#closeAiModal')
    };

    this.lyricLineEls = [];
    this.lyricsBound = false;
    this.lrcCache = new Map();
    this.audioPreload = new Map();
    this.currentVideoUrl = null;

    window.readingSystem = this;
    this.init();
  }

  async init() {
    await this.loadBooks();
    await this.applyBookFromHash();
    this.bindEvents();
    this.loadPlayModePreference();
    this.updatePlayModeUI();
    this.loadTranslationPreference();
    this.updateTranslationToggle();
    this.loadFontPreference();
    await this.loadUnitFromStorage();
    this.checkPersistentFolder();
  }

  // 更新文件夹关联状态 UI
  updateFolderStatus(isLinked) {
    if (isLinked) {
      if (this.dom.linkFolderText) this.dom.linkFolderText.textContent = '已关联文件夹';
      if (this.dom.linkLocalFolder) this.dom.linkLocalFolder.style.background = '#4CAF50';
    } else {
      if (this.dom.linkFolderText) this.dom.linkFolderText.textContent = '关联本地视频';
      if (this.dom.linkLocalFolder) this.dom.linkLocalFolder.style.background = '#ff6321';
    }
  }

  // 检查是否有持久化的文件夹授权
  async checkPersistentFolder() {
    // 在 iframe 中可能无法恢复授权
    if (window.self !== window.top) return;

    try {
      const db = await this.openDB();
      const handles = await this.getHandles(db);
      if (handles && handles.length > 0) {
        let totalFiles = 0;
        for (const handle of handles) {
          try {
            const options = { mode: 'read' };
            if ((await handle.queryPermission(options)) === 'granted') {
              const files = await this.scanDirectory(handle, true); // true means append
              totalFiles += files.length;
            }
          } catch (err) {
            console.warn('Failed to restore handle:', handle.name, err);
          }
        }
        
        if (totalFiles > 0) {
          this.updateFolderStatus(true);
          this.showToast(`已恢复 ${totalFiles} 个本地视频文件`);
        } else {
          if (this.dom.linkFolderText) this.dom.linkFolderText.textContent = '恢复视频访问';
          if (this.dom.linkLocalFolder) this.dom.linkLocalFolder.style.background = '#28a745';
        }
      }
    } catch (e) {
      console.log('Persistent folder check failed:', e);
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NCE_Storage', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  saveHandle(db, handle) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      const store = tx.objectStore('handles');
      const getReq = store.get('handleList');
      
      getReq.onsuccess = () => {
        const list = getReq.result || [];
        // Check if handle already exists by name
        if (!list.some(h => h.name === handle.name)) {
          list.push(handle);
          store.put(list, 'handleList');
        }
        tx.oncomplete = () => resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  getHandles(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly');
      const request = tx.objectStore('handles').get('handleList');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async loadBooks() {
    if (this.state.books.length) return this.state.books;
    try {
      const response = await fetch('data.json');
      const data = await response.json();
      this.state.books = Array.isArray(data.books) ? data.books : [];
    } catch (error) {
      console.error('加载课本数据失败:', error);
      this.state.books = [];
    }
    return this.state.books;
  }

  resolveBookByKey(bookKey) {
    if (!this.state.books.length) return null;
    const exact = this.state.books.find((book) => book && book.key === bookKey);
    if (exact && exact.bookPath) return exact;
    const fallback = this.state.books.find((book) => book && book.key === DEFAULT_BOOK_KEY);
    if (fallback && fallback.bookPath) return fallback;
    return this.state.books.find((book) => book && book.bookPath) || null;
  }

  async applyBookFromHash() {
    const keyFromHash = location.hash.slice(1).trim();
    const storedBookKey = this.loadBookPreference();
    const initialBookKey = keyFromHash || storedBookKey || DEFAULT_BOOK_KEY;
    await this.applyBookChange(initialBookKey);
  }

  loadBookPreference() {
    return localStorage.getItem(BOOK_SELECTION_STORAGE_KEY)?.trim() || '';
  }

  persistBookPreference(bookKey) {
    if (!bookKey) return;
    localStorage.setItem(BOOK_SELECTION_STORAGE_KEY, bookKey);
  }

  async applyBookChange(bookKey) {
    await this.loadBooks();
    const resolved = this.resolveBookByKey(bookKey);

    if (!resolved || !resolved.bookPath) {
      this.state.bookPath = '';
      this.state.bookKey = '';
      this.renderEmptyState('未找到可用课本数据');
      return;
    }

    this.state.bookKey = resolved.key || bookKey;
    this.state.bookPath = resolved.bookPath.trim();
    this.persistBookPreference(this.state.bookKey);

    this.updateBookSelects();
    await this.loadBookConfig();
    this.renderCourseTree();
    this.resetUnitListScroll();
  }

  renderEmptyState(message) {
    if (this.dom.lyricsDisplay) {
      this.dom.lyricsDisplay.innerHTML = `<p class="placeholder">${message}</p>`;
    }
    if (this.dom.courseTree) {
      this.dom.courseTree.innerHTML = `<p class="placeholder">${message}</p>`;
    }
    this.resetUnitListScroll();
  }

  resetUnitListScroll() {
    const scrollContainer = this.dom.courseTree?.closest('.unit-list');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }

  async loadBookConfig() {
    if (!this.state.bookPath) {
      this.renderEmptyState('未找到可用课本数据');
      return;
    }

    try {
      const response = await fetch(`${this.state.bookPath}/book.json`);
      const data = await response.json();

      this.state.units = data.units.map((unit, index) => ({
        ...unit,
        id: index + 1,
        title: unit.title,
        audio: `${this.state.bookPath}/${unit.filename}.mp3`,
        lrc: `${this.state.bookPath}/${unit.filename}.lrc`
      }));

      if (this.dom.bookName) {
        this.dom.bookName.textContent = `《${data.bookName}》`;
      }
      if (this.dom.bookLevel) {
        this.dom.bookLevel.textContent = `${data.bookLevel}`;
      }
      if (this.dom.bookCover && data.bookCover) {
        this.dom.bookCover.src = `${this.state.bookPath}/${data.bookCover}`;
      }
      this.lrcCache.clear();
      this.audioPreload.clear();
    } catch (error) {
      console.error('加载课件配置失败:', error);
      this.renderEmptyState(`课件配置加载失败，请检查 ${this.state.bookPath}/book.json 文件`);
    }
  }

  renderCourseTree() {
    if (!this.dom.courseTree || !this.state.books.length) return;

    this.dom.courseTree.innerHTML = this.state.books
      .map((book) => {
        const isCurrent = book.key === this.state.bookKey;
        return `
          <div class="course-item ${isCurrent ? 'expanded' : ''}" data-book-key="${book.key}">
            <div class="course-header ${isCurrent ? 'active' : ''}" onclick="window.readingSystem.toggleCourse('${book.key}')">
              <span>${book.title}</span>
              <svg class="toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="course-content" id="content-${book.key.replace(/[^a-zA-Z0-9]/g, '_')}">
              ${isCurrent ? this.getUnitListHtml() : ''}
            </div>
          </div>
        `;
      })
      .join('');
  }

  toggleCourse(bookKey) {
    if (bookKey === this.state.bookKey) {
      const item = qs(`.course-item[data-book-key="${bookKey}"]`);
      if (item) item.classList.toggle('expanded');
      return;
    }

    this.applyBookChange(bookKey).then(() => {
      this.loadUnitFromStorage();
    });
  }

  getUnitListHtml() {
    return this.state.units
      .map(
        (unit, index) => `
      <div class="lesson-item ${index === this.state.currentUnitIndex ? 'active' : ''}" 
           data-unit-index="${index}" 
           onclick="window.readingSystem.loadUnitByIndex(${index}, { shouldScrollUnitIntoView: true })">
        ${unit.title}
      </div>
    `
      )
      .join('');
  }

  renderUnitSelect() {
    // This is now handled by renderCourseTree and getUnitListHtml
    const currentContent = qs(`#content-${this.state.bookKey.replace(/[^a-zA-Z0-9]/g, '_')}`);
    if (currentContent) {
      currentContent.innerHTML = this.getUnitListHtml();
    }
  }

  async loadUnitFromStorage() {
    if (!this.state.units.length) return;

    const stored = localStorage.getItem(`${this.state.bookPath}/currentUnitIndex`);
    const parsed = stored ? parseInt(stored) : 0;
    const safeIndex = Number.isFinite(parsed)
      ? clamp(parsed, 0, this.state.units.length - 1)
      : 0;

    await this.loadUnitByIndex(safeIndex, { shouldScrollUnitIntoView: true });
  }

  async loadUnitByIndex(unitIndex, options = {}) {
    const { shouldScrollUnitIntoView = false } = options;

    this.state.currentUnitIndex = unitIndex;
    localStorage.setItem(`${this.state.bookPath}/currentUnitIndex`, unitIndex);

    const unit = this.state.units[unitIndex];
    if (!unit) return;

    this.resetPlayer();
    this.updateActiveUnit(unitIndex, { shouldScrollUnitIntoView });
    this.updateNavigationButtons();

    try {
      let lrcText = this.lrcCache.get(unit.lrc);
      if (!lrcText) {
        const response = await fetch(unit.lrc);
        lrcText = await response.text();
        this.lrcCache.set(unit.lrc, lrcText);
      }
      this.state.currentLyrics = LRCParser.parse(lrcText);
      this.renderLyrics();
    } catch (error) {
      console.error('加载歌词失败:', error);
      if (this.dom.lyricsDisplay) {
        this.dom.lyricsDisplay.innerHTML = '<p class="placeholder">加载失败</p>';
      }
    }

    if (this.dom.audioPlayer) {
      this.setPlayButtonDisabled(true);
      this.dom.audioPlayer.src = unit.audio;
      this.dom.audioPlayer.load();
    }

    this.loadPlayTime();
    this.loadSavedSpeed();
    this.prefetchUnit(unitIndex + 1);
    this.loadLessonSource();
  }

  async loadLessonSource(isExercise = false) {
    if (!this.state.units.length || this.state.currentUnitIndex === -1) return;

    const teacherRadio = document.querySelector('input[name="teacher"]:checked');
    const teacher = teacherRadio ? teacherRadio.value : 'textbook';
    this.state.teacher = teacher;
    
    // 切换主区域显示
    if (teacher === 'textbook') {
      if (this.dom.lyricsContainer) this.dom.lyricsContainer.style.display = 'block';
      if (this.dom.catalogContainer) this.dom.catalogContainer.style.display = 'none';
      // 课文模式：隐藏视频窗口并停止播放
      if (this.dom.videoFloatingWindow) this.dom.videoFloatingWindow.style.display = 'none';
      if (this.dom.mainVideo) {
        this.dom.mainVideo.pause();
        this.dom.mainVideo.src = '';
      }
      return;
    } else {
      if (this.dom.lyricsContainer) this.dom.lyricsContainer.style.display = 'none';
      if (this.dom.catalogContainer) this.dom.catalogContainer.style.display = 'flex';
      this.renderCatalog(teacher);
    }

    const unit = this.state.units[this.state.currentUnitIndex];
    const lessonMatch = unit.title.match(/(?:Lesson\s+)?(\d+)/i);
    
    if (!lessonMatch) {
      if (this.dom.videoFloatingWindow) this.dom.videoFloatingWindow.style.display = 'none';
      return;
    }

    let lessonNum = parseInt(lessonMatch[1]);
    
    // 雪梨老师逻辑：始终找单数课
    if (teacher === 'shirley' && lessonNum % 2 === 0) {
      lessonNum -= 1;
    }
    
    // Frank 老师逻辑：如果是练习模式，课号+1
    if (teacher === 'frank' && isExercise) {
      lessonNum += 1;
    }

    const prefix = `Lesson ${lessonNum}.`;
    const altPrefix = `${lessonNum}.`;
    const formattedNum = String(lessonNum).padStart(3, '0');

    if (this.state.localFiles && this.state.localFiles.length > 0) {
      const matchedFiles = this.state.localFiles.filter(file => {
        const name = file.name;
        const isMatch = (name.includes(prefix) || name.includes(altPrefix) || name.startsWith(formattedNum)) && name.endsWith('.mp4');
        const isCorrectTeacher = this.isTeacherMatch(file, teacher);
        return isMatch && isCorrectTeacher;
      });

      if (matchedFiles.length > 0) {
        if (this.dom.videoFloatingWindow) this.dom.videoFloatingWindow.style.display = 'flex';
        if (this.dom.videoTitle) this.dom.videoTitle.textContent = `${teacher === 'shirley' ? '雪梨' : 'Frank'} - Lesson ${lessonNum}`;
        
        // Frank 老师显示切换练习按钮
        if (this.dom.toggleExerciseBtn) {
          this.dom.toggleExerciseBtn.style.display = teacher === 'frank' ? 'block' : 'none';
          this.dom.toggleExerciseBtn.textContent = isExercise ? '返回课文' : '切换练习课';
          this.dom.toggleExerciseBtn.onclick = () => this.loadLessonSource(!isExercise);
        }

        matchedFiles.sort((a, b) => {
          const aScore = (a.name.includes('练习') || a.name.includes('单词')) ? 1 : 0;
          const bScore = (b.name.includes('练习') || b.name.includes('单词')) ? 1 : 0;
          return aScore - bScore;
        });

        const finalFile = matchedFiles[0];
        this.playVideo(finalFile);
        return;
      }
    }

    if (this.dom.videoFloatingWindow) this.dom.videoFloatingWindow.style.display = 'none';
  }

  isTeacherMatch(file, teacher) {
    const name = file.name.toLowerCase();
    const path = (file.webkitRelativePath || '').toLowerCase();
    const root = (this.state.rootFolderName || '').toLowerCase();
    
    const teacherKeywords = teacher === 'shirley' ? ['shirley', '雪梨'] : ['frank'];
    const otherTeacherKeywords = teacher === 'shirley' ? ['frank'] : ['shirley', '雪梨'];
    
    const matchInPath = teacherKeywords.some(kw => path.includes(kw));
    const matchInName = teacherKeywords.some(kw => name.includes(kw));
    const matchInRoot = teacherKeywords.some(kw => root.includes(kw));
    
    // 如果路径或文件名包含老师关键字，则匹配
    if (matchInPath || matchInName) return true;
    
    // 如果根文件夹名匹配，且子路径中没有明确提到其他老师，则也视为匹配（解决直接关联老师文件夹的情况）
    if (matchInRoot) {
      const otherMatchInPath = otherTeacherKeywords.some(kw => path.includes(kw));
      const otherMatchInName = otherTeacherKeywords.some(kw => name.includes(kw));
      return !otherMatchInPath && !otherMatchInName;
    }
    
    return false;
  }

  renderCatalog(teacher) {
    if (!this.dom.catalogGrid) return;
    
    const teacherName = teacher === 'shirley' ? '雪梨老师' : 'Frank 老师';
    if (this.dom.catalogTitle) this.dom.catalogTitle.textContent = `${teacherName} 课程目录`;
    
    const filteredFiles = this.state.localFiles.filter(file => {
      return file.name.endsWith('.mp4') && this.isTeacherMatch(file, teacher);
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    
    if (this.dom.catalogCount) this.dom.catalogCount.textContent = `${filteredFiles.length} 个视频`;
    
    // Change grid to list
    this.dom.catalogGrid.className = 'catalog-list';
    this.dom.catalogGrid.innerHTML = '';
    
    if (filteredFiles.length === 0) {
      this.dom.catalogGrid.innerHTML = '<p class="placeholder" style="grid-column: 1/-1; text-align: center; padding: 40px;">未找到相关视频，请确保已关联包含老师名称的文件夹。</p>';
      return;
    }
    
    filteredFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'catalog-item';
      if (this.state.currentVideoName === file.name) item.classList.add('active');
      
      const lessonMatch = file.name.match(/Lesson\s*(\d+)/i) || file.name.match(/(\d+)/);
      const lessonNum = lessonMatch ? lessonMatch[1] : '?';
      
      item.innerHTML = `
        <div class="catalog-item-icon">${teacher === 'shirley' ? '👩‍🏫' : '👨‍🏫'}</div>
        <div class="catalog-item-info">
          <span class="catalog-item-name">${file.name}</span>
          <span class="catalog-item-lesson">Lesson ${lessonNum}</span>
        </div>
      `;
      
      item.onclick = () => {
        this.playVideo(file);
        this.renderCatalog(teacher);
      };
      
      this.dom.catalogGrid.appendChild(item);
    });
  }

  playVideo(file) {
    if (this.currentVideoUrl) URL.revokeObjectURL(this.currentVideoUrl);
    this.currentVideoUrl = URL.createObjectURL(file);
    this.state.currentVideoName = file.name;
    
    if (this.dom.videoFloatingWindow) this.dom.videoFloatingWindow.style.display = 'flex';
    this.dom.mainVideo.src = this.currentVideoUrl;
    this.dom.mainVideo.play();
    
    if (this.dom.audioPlayer) this.dom.audioPlayer.pause();
    this.updatePlaylist();
  }

  async bindLocalFolder() {
    if (!this.dom.linkLocalFolder || !this.dom.localFolderInput) return;
    
    // 检测是否在 iframe 中运行
    const isInIframe = window.self !== window.top;

    // 优先使用 File System Access API (仅在非 iframe 或支持的环境)
    if ('showDirectoryPicker' in window && !isInIframe) {
      this.dom.linkLocalFolder.onclick = async () => {
        try {
          // 如果已经有句柄，先尝试验证权限
          if (this.state.directoryHandle) {
            const options = { mode: 'read' };
            if ((await this.state.directoryHandle.queryPermission(options)) === 'granted' || 
                (await this.state.directoryHandle.requestPermission(options)) === 'granted') {
              await this.scanDirectory(this.state.directoryHandle);
              return;
            }
          }

          const handle = await window.showDirectoryPicker();
          this.state.directoryHandle = handle;
          const db = await this.openDB();
          await this.saveHandle(db, handle);
          await this.scanDirectory(handle);
        } catch (err) {
          console.error('Directory picker error:', err);
          if (err.name === 'SecurityError' || err.message.includes('sub frames')) {
            this.showToast('⚠️ 浏览器限制，请使用备用方式选择文件夹');
            this.dom.localFolderInput.click();
          } else if (err.name !== 'AbortError') {
            this.dom.localFolderInput.click();
          }
        }
      };
    } else {
      // 在 iframe 中或不支持 API 时，直接使用 input 方式
      this.dom.linkLocalFolder.onclick = () => {
        if (isInIframe) {
          this.showToast('ℹ️ 当前环境限制，请选择文件夹以关联视频');
        }
        this.dom.localFolderInput.click();
      };
    }

    this.dom.localFolderInput.addEventListener('change', (event) => {
      const files = Array.from(event.target.files);
      if (files.length > 0) {
        this.state.localFiles = files;
        this.showToast(`✅ 已成功关联本地视频库 (${files.length} 个文件)`);
        this.updateFolderStatus(true);
        this.loadLessonSource();
      }
    });

    // 绑定悬浮窗拖拽
    this.initFloatingWindow();
  }

  async scanDirectory(handle, append = false) {
    this.state.rootFolderName = handle.name;
    const files = [];
    async function getFiles(dirHandle, path = '') {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          // 模拟 webkitRelativePath
          Object.defineProperty(file, 'webkitRelativePath', {
            value: path + entry.name
          });
          files.push(file);
        } else if (entry.kind === 'directory') {
          await getFiles(entry, path + entry.name + '/');
        }
      }
    }
    await getFiles(handle);
    
    if (append) {
      // 合并并去重
      const merged = [...this.state.localFiles, ...files];
      this.state.localFiles = merged.filter((file, index, self) => 
        index === self.findIndex((f) => f.webkitRelativePath === file.webkitRelativePath)
      );
    } else {
      this.state.localFiles = files;
    }

    if (!append) {
      this.showToast(`✅ 已成功读取 ${files.length} 个视频文件`);
      this.updateFolderStatus(true);
    }
    
    if (this.state.currentUnitIndex !== -1) {
      this.loadLessonSource();
    }
    
    return files;
  }

  showToast(text) {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#ff6321; color:white; padding:10px 20px; border-radius:8px; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.2);';
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }

  initFloatingWindow() {
    const win = this.dom.videoFloatingWindow;
    const header = this.dom.videoHeader;
    if (!win || !header) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, win);
      }
    }

    function setTranslate(x, y, el) {
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    function dragEnd(e) {
      isDragging = false;
    }

    // 绑定关闭按钮
    if (this.dom.closeVideoBtn) {
      this.dom.closeVideoBtn.onclick = () => {
        win.style.display = 'none';
        // 切换回课文模式
        const textbookRadio = document.querySelector('input[name="teacher"][value="textbook"]');
        if (textbookRadio) textbookRadio.checked = true;
      };
    }

    // 绑定缩放 (简单实现)
    const handle = win.querySelector('.resize-handle');
    if (handle) {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startWidth = win.offsetWidth;
        const startHeight = win.offsetHeight;
        const startX = e.clientX;
        const startY = e.clientY;

        const doResize = (moveEvent) => {
          win.style.width = startWidth + (moveEvent.clientX - startX) + 'px';
          // 高度由视频比例决定，或者也可以手动设置
        };

        const stopResize = () => {
          document.removeEventListener('mousemove', doResize);
          document.removeEventListener('mouseup', stopResize);
        };

        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
      });
    }
  }

  switchVideo(type) {
    if (!this.state.videoSources) return;
    const src = this.state.videoSources[type];
    if (src) {
      this.dom.mainVideo.src = src;
      this.dom.mainVideo.load();
      
      if (this.dom.btnMainVid && this.dom.btnGrammarVid) {
        this.dom.btnMainVid.style.background = type === 'main' ? 'var(--accent-1)' : 'var(--paper-3)';
        this.dom.btnGrammarVid.style.background = type === 'grammar' ? 'var(--accent-1)' : 'var(--paper-3)';
        this.dom.btnMainVid.style.color = type === 'main' ? '#fff' : 'var(--ink-1)';
        this.dom.btnGrammarVid.style.color = type === 'grammar' ? '#fff' : 'var(--ink-1)';
      }
    }
  }

  resetPlayer() {
    if (this.dom.audioPlayer) {
      this.dom.audioPlayer.pause();
      this.dom.audioPlayer.currentTime = 0;
    }

    this.setPlayButtonDisabled(true);

    if (this.dom.progressBar) this.dom.progressBar.style.setProperty('--progress', '0%');
    if (this.dom.currentTime) this.dom.currentTime.textContent = '0:00';
    if (this.dom.duration) this.dom.duration.textContent = '0:00';

    this.updatePlayButton();
    this.state.currentLyricIndex = -1;
    this.state.singlePlayEndTime = null;
  }

  safePlay() {
    if (!this.dom.audioPlayer) return;
    const playPromise = this.dom.audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        if (error.name !== 'AbortError') {
          console.warn('Playback failed:', error);
        }
      });
    }
  }

  updateActiveUnit(unitIndex, options = {}) {
    const { shouldScrollUnitIntoView = false } = options;

    const lessonItems = qsa('.lesson-item');
    let activeItem = null;

    lessonItems.forEach((item) => {
      const idx = parseInt(item.dataset.unitIndex);
      if (idx === unitIndex) {
        item.classList.add('active');
        activeItem = item;
      } else {
        item.classList.remove('active');
      }
    });

    if (activeItem && shouldScrollUnitIntoView) {
      activeItem.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  renderLyrics() {
    if (!this.dom.lyricsDisplay) return;

    if (this.dom.lyricsContainer) {
      this.dom.lyricsContainer.scrollTop = 0;
    }

    if (!this.state.currentLyrics.length) {
      this.dom.lyricsDisplay.innerHTML = '<p class="placeholder">没有歌词数据</p>';
      return;
    }

    this.dom.lyricsDisplay.innerHTML = this.state.currentLyrics
      .map(
        (lyric, index) => `
      <div class="lyric-line" data-index="${index}" data-time="${lyric.time}" tabindex="0" role="button" aria-label="播放第 ${index + 1} 句">
        <div class="lyric-text">${lyric.english}</div>
        ${lyric.chinese ? `<div class="lyric-translation">${lyric.chinese}</div>` : ''}
      </div>
    `
      )
      .join('');

    this.lyricLineEls = qsa('.lyric-line', this.dom.lyricsDisplay);
    this.state.currentLyricIndex = -1;
  }

  handleLyricActivate(line) {
    const index = parseInt(line.dataset.index);
    const time = parseFloat(line.dataset.time);
    this.playLyricAtIndex(index, time);
    this.persistPlayTime(time);
  }

  playLyricAtIndex(index, time) {
    if (!this.dom.audioPlayer) return;

    this.dom.audioPlayer.currentTime = time;

    if (this.state.playMode === 'single') {
      const nextLyric = this.state.currentLyrics[index + 1];
      this.state.singlePlayEndTime = nextLyric ? nextLyric.time : this.dom.audioPlayer.duration;
    } else {
      this.state.singlePlayEndTime = null;
    }

    this.safePlay();
  }

  persistPlayTime(time) {
    localStorage.setItem(`${this.state.bookPath}/${this.state.currentUnitIndex}/playTime`, time);
  }

  checkSinglePlayEnd() {
    if (this.state.playMode !== 'single' || this.state.singlePlayEndTime === null || !this.dom.audioPlayer) {
      return;
    }

    const currentTime = this.dom.audioPlayer.currentTime;
    if (currentTime >= this.state.singlePlayEndTime && this.state.singlePlayEndTime !== this.dom.audioPlayer.duration) {
      this.dom.audioPlayer.pause();
      this.dom.audioPlayer.currentTime = this.state.singlePlayEndTime - 0.01;
      this.state.singlePlayEndTime = null;
    }
  }

  updateProgress() {
    if (!this.dom.progressBar || !this.dom.audioPlayer) return;

    if (this.dom.audioPlayer.duration && !this.state.isProgressDragging) {
      const percent = (this.dom.audioPlayer.currentTime / this.dom.audioPlayer.duration) * 100;
      this.dom.progressBar.style.setProperty('--progress', `${percent}%`);
      if (this.dom.currentTime) {
        this.dom.currentTime.textContent = this.formatTime(this.dom.audioPlayer.currentTime);
      }
    }
  }

  updateDuration() {
    if (!this.dom.audioPlayer) return;

    if (this.dom.duration) {
      this.dom.duration.textContent = this.formatTime(this.dom.audioPlayer.duration);
    }
    if (this.state.savedPlayTime > 0 && this.dom.audioPlayer.duration) {
      this.dom.audioPlayer.currentTime = Math.min(this.state.savedPlayTime, this.dom.audioPlayer.duration - 0.1);
      this.state.savedPlayTime = 0;
      this.updateProgress();
    }
  }

  updatePlayButton() {
    if (!this.dom.playPauseBtn || !this.dom.audioPlayer) return;

    if (this.dom.audioPlayer.paused) {
      this.dom.playPauseBtn.classList.remove('playing');
    } else {
      this.dom.playPauseBtn.classList.add('playing');
    }
  }

  setPlayButtonDisabled(disabled) {
    if (!this.dom.playPauseBtn) return;
    this.dom.playPauseBtn.disabled = disabled;
    this.dom.playPauseBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  cyclePlaybackSpeed() {
    const currentIndex = this.state.availableSpeeds.indexOf(this.state.playbackRate);
    const nextIndex = (currentIndex + 1) % this.state.availableSpeeds.length;
    this.state.playbackRate = this.state.availableSpeeds[nextIndex];

    if (this.dom.audioPlayer) {
      this.dom.audioPlayer.playbackRate = this.state.playbackRate;
    }

    this.updateSpeedButton();
    localStorage.setItem('playbackRate', this.state.playbackRate);
  }

  updateSpeedButton() {
    if (!this.dom.speedText || !this.dom.speedBtn) return;

    this.dom.speedText.textContent = `${this.state.playbackRate}x`;

    if (this.state.playbackRate !== 1.0) {
      this.dom.speedBtn.classList.add('active');
    } else {
      this.dom.speedBtn.classList.remove('active');
    }
  }

  loadPlayTime() {
    const time = localStorage.getItem(`${this.state.bookPath}/${this.state.currentUnitIndex}/playTime`);
    if (time) {
      const parsed = parseFloat(time);
      if (Number.isFinite(parsed)) {
        this.state.savedPlayTime = parsed;
      }
    }
  }

  loadSavedSpeed() {
    const savedSpeed = localStorage.getItem('playbackRate');
    if (savedSpeed) {
      const parsed = parseFloat(savedSpeed);
      if (!Number.isFinite(parsed)) return;
      this.state.playbackRate = parsed;
      if (this.dom.audioPlayer) {
        this.dom.audioPlayer.playbackRate = this.state.playbackRate;
      }
      this.updateSpeedButton();
    }
  }

  updateNavigationButtons() {
    if (this.dom.prevUnitBtn) {
      this.dom.prevUnitBtn.disabled = this.state.currentUnitIndex <= 0;
    }

    if (this.dom.nextUnitBtn) {
      this.dom.nextUnitBtn.disabled = this.state.currentUnitIndex >= this.state.units.length - 1;
    }
  }

  loadPreviousUnit() {
    if (this.state.currentUnitIndex > 0) {
      this.loadUnitByIndex(this.state.currentUnitIndex - 1);
    }
  }

  loadNextUnit() {
    if (this.state.currentUnitIndex < this.state.units.length - 1) {
      this.loadUnitByIndex(this.state.currentUnitIndex + 1);
    }
  }

  togglePlayMode() {
    this.state.playMode = this.state.playMode === 'single' ? 'continuous' : 'single';
    localStorage.setItem(PLAY_MODE_STORAGE_KEY, this.state.playMode);
    this.updatePlayModeUI();
  }

  updatePlayModeUI() {
    if (!this.dom.playModeBtn) return;

    if (this.state.playMode === 'single') {
      this.dom.playModeBtn.title = '单句点读';
      this.dom.playModeBtn.setAttribute('aria-label', '单句点读');
      this.dom.playModeBtn.setAttribute('aria-pressed', 'false');
      this.dom.playModeBtn.dataset.mode = 'single';
      this.dom.playModeBtn.classList.remove('continuous-mode');
    } else {
      this.dom.playModeBtn.title = '连续点读';
      this.dom.playModeBtn.setAttribute('aria-label', '连续点读');
      this.dom.playModeBtn.setAttribute('aria-pressed', 'true');
      this.dom.playModeBtn.dataset.mode = 'continuous';
      this.dom.playModeBtn.classList.add('continuous-mode');
    }
  }

  loadPlayModePreference() {
    const storedMode = localStorage.getItem(PLAY_MODE_STORAGE_KEY);
    if (storedMode === 'single' || storedMode === 'continuous') {
      this.state.playMode = storedMode;
    }
  }

  handleAudioEnded() {
    if (this.state.playMode === 'continuous') {
      this.playNextLyric();
    }
  }

  playNextLyric() {
    const nextIndex = this.state.currentLyricIndex + 1;
    if (nextIndex < this.state.currentLyrics.length && this.dom.audioPlayer) {
      const nextLyric = this.state.currentLyrics[nextIndex];
      this.dom.audioPlayer.currentTime = nextLyric.time;
      this.safePlay();
    }
  }

  updateLyricHighlight() {
    if (!this.lyricLineEls.length || !this.dom.audioPlayer) return;

    const currentTime = this.dom.audioPlayer.currentTime;
    let newIndex = -1;
    for (let i = this.state.currentLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= this.state.currentLyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex === this.state.currentLyricIndex) return;

    if (this.state.currentLyricIndex >= 0 && this.lyricLineEls[this.state.currentLyricIndex]) {
      this.lyricLineEls[this.state.currentLyricIndex].classList.remove('active');
      this.lyricLineEls[this.state.currentLyricIndex].classList.remove('pulse');
    }

    this.state.currentLyricIndex = newIndex;

    if (newIndex >= 0) {
      const activeLine = this.lyricLineEls[newIndex];
      if (activeLine) {
        activeLine.classList.add('active');
        activeLine.classList.add('pulse');
        if (this.shouldScrollLyricIntoView(activeLine)) {
          activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  prefetchUnit(unitIndex) {
    const unit = this.state.units[unitIndex];
    if (!unit) return;

    if (unit.lrc && !this.lrcCache.has(unit.lrc)) {
      fetch(unit.lrc)
        .then((response) => response.text())
        .then((text) => this.lrcCache.set(unit.lrc, text))
        .catch(() => {});
    }

    if (unit.audio && !this.audioPreload.has(unit.audio)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = unit.audio;
      this.audioPreload.set(unit.audio, audio);
    }
  }

  shouldScrollLyricIntoView(activeLine) {
    if (!this.dom.lyricsContainer) return true;
    const containerRect = this.dom.lyricsContainer.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const topThreshold = containerRect.top + containerRect.height * 0.22;
    const bottomThreshold = containerRect.bottom - containerRect.height * 0.22;
    return lineRect.top < topThreshold || lineRect.bottom > bottomThreshold;
  }

  bindEvents() {
    this.bindLyrics();
    this.bindPlayerControls();
    this.bindNavigation();
    this.bindTranslationToggle();
    this.bindLocalFolder();
    this.bindFontSettings();
    this.bindAiExplain();

    // 老师切换监听
    document.querySelectorAll('input[name="teacher"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.loadLessonSource();
        this.updatePlaylist();
      });
    });

    window.loadLessonSource = () => this.loadLessonSource();
    window.addEventListener('hashchange', () => {
      const newKey = location.hash.slice(1).trim() || DEFAULT_BOOK_KEY;
      if (newKey === this.state.bookKey) return;
      this.applyBookChange(newKey).then(() => this.loadUnitFromStorage());
    });
  }

  bindTranslationToggle() {
    if (!this.dom.toggleTranslationBtn) return;
    this.dom.toggleTranslationBtn.addEventListener('click', () => {
      const modes = ['show', 'hide', 'blur'];
      const currentIndex = modes.indexOf(this.state.translationMode);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length;
      this.state.translationMode = modes[nextIndex];
      localStorage.setItem('translationMode', this.state.translationMode);
      this.updateTranslationToggle();
    });
  }

  loadFontPreference() {
    const savedFont = localStorage.getItem('fontFamily');
    if (savedFont) {
      document.body.style.fontFamily = savedFont;
      if (this.dom.fontFamilySelect) {
        this.dom.fontFamilySelect.value = savedFont;
      }
    }
  }

  loadTranslationPreference() {
    const storedMode = localStorage.getItem('translationMode');
    if (storedMode === 'show' || storedMode === 'hide' || storedMode === 'blur') {
      this.state.translationMode = storedMode;
    }
  }

  updateTranslationToggle() {
    if (!this.dom.toggleTranslationBtn) return;
    const mode = this.state.translationMode;
    document.body.classList.toggle('hide-translation', mode === 'hide');
    document.body.classList.toggle('blur-translation', mode === 'blur');

    if (mode === 'show') {
      this.dom.toggleTranslationBtn.textContent = '中';
      this.dom.toggleTranslationBtn.setAttribute('aria-pressed', 'true');
      this.dom.toggleTranslationBtn.setAttribute('aria-label', '翻译显示');
    } else if (mode === 'blur') {
      this.dom.toggleTranslationBtn.textContent = '模';
      this.dom.toggleTranslationBtn.setAttribute('aria-pressed', 'mixed');
      this.dom.toggleTranslationBtn.setAttribute('aria-label', '翻译模糊显示');
    } else {
      this.dom.toggleTranslationBtn.textContent = '英';
      this.dom.toggleTranslationBtn.setAttribute('aria-pressed', 'false');
      this.dom.toggleTranslationBtn.setAttribute('aria-label', '仅显示英文');
    }
  }

  bindFontSettings() {
    if (this.dom.fontFamilySelect) {
      this.dom.fontFamilySelect.onchange = (e) => {
        document.body.style.fontFamily = e.target.value;
        localStorage.setItem('fontFamily', e.target.value);
      };
    }

    if (this.dom.increaseFontSize) {
      this.dom.increaseFontSize.onclick = () => {
        this.state.fontSize = Math.min(this.state.fontSize + 1, 30);
        this.updateFontSize();
      };
    }

    if (this.dom.decreaseFontSize) {
      this.dom.decreaseFontSize.onclick = () => {
        this.state.fontSize = Math.max(this.state.fontSize - 1, 12);
        this.updateFontSize();
      };
    }

    if (this.dom.togglePlaylistBtn) {
      this.dom.togglePlaylistBtn.onclick = () => {
        if (this.dom.videoPlaylist) {
          const isHidden = this.dom.videoPlaylist.style.display === 'none';
          this.dom.videoPlaylist.style.display = isHidden ? 'flex' : 'none';
        }
      };
    }
  }

  bindAiExplain() {
    if (this.dom.aiExplainBtn) {
      this.dom.aiExplainBtn.addEventListener('click', () => this.handleAiExplain());
    }
    if (this.dom.closeAiModal) {
      this.dom.closeAiModal.addEventListener('click', () => {
        this.dom.aiModal.style.display = 'none';
      });
    }
    window.addEventListener('click', (e) => {
      if (e.target === this.dom.aiModal) {
        this.dom.aiModal.style.display = 'none';
      }
    });
  }

  async handleAiExplain() {
    if (!this.state.currentLyrics || this.state.currentLyrics.length === 0) {
      this.showToast('请先选择一个 Unit');
      return;
    }

    this.dom.aiModal.style.display = 'flex';
    this.dom.aiContent.innerHTML = `
      <div class="ai-loading" style="text-align: center; padding: 20px;">
        <div class="spinner" style="border: 3px solid rgba(0,0,0,0.1); border-top: 3px solid #4a90e2; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
        <span>AI 正在分析课文并生成讲解...</span>
      </div>
    `;

    const fullText = this.state.currentLyrics.map(l => l.english).join('\n');
    const bookName = this.dom.bookName.textContent;
    const unitTitle = this.state.units[this.state.currentUnitIndex]?.title || '';

    const prompt = `
      你是一个专业的英语老师。请对以下《${bookName}》中的课文《${unitTitle}》进行详细讲解。
      讲解应包括：
      1. 核心词汇解析（重点单词及例句）
      2. 关键语法点拨（课文中的重要句型）
      3. 课文背景或文化知识（如果有）
      4. 学习建议
      
      课文内容：
      ${fullText}
      
      请使用 Markdown 格式输出，并确保内容通俗易懂，适合英语学习者。
    `;

    try {
      const { aiService } = await import('./aiService.js');
      const explanation = await aiService.generateContent(prompt);
      
      // Simple markdown to HTML conversion (just for basic formatting)
      const htmlContent = explanation
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

      this.dom.aiContent.innerHTML = `
        <div class="ai-explanation-result">
          ${htmlContent}
        </div>
      `;
    } catch (error) {
      console.error("AI Explanation failed:", error);
      this.dom.aiContent.innerHTML = `
        <div style="color: #d32f2f; padding: 20px; text-align: center;">
          <p>抱歉，生成讲解时出现错误。</p>
          <p style="font-size: 12px;">${error.message}</p>
          <button id="retryAiBtn" style="margin-top: 10px; padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">重试</button>
        </div>
      `;
      document.getElementById('retryAiBtn').onclick = () => this.handleAiExplain();
    }
  }

  updateFontSize() {
    if (!this.dom.lyricsContainer) return;
    const lines = this.dom.lyricsContainer.querySelectorAll('.lyric-text');
    lines.forEach(line => {
      line.style.fontSize = `${this.state.fontSize}px`;
    });
  }

  updatePlaylist() {
    if (!this.dom.playlistItems) return;
    this.dom.playlistItems.innerHTML = '';
    
    const teacherRadio = document.querySelector('input[name="teacher"]:checked');
    const teacher = teacherRadio ? teacherRadio.value : 'textbook';
    if (teacher === 'textbook') return;

    // 筛选当前老师的视频
    const filteredFiles = this.state.localFiles.filter(file => {
      return file.name.endsWith('.mp4') && this.isTeacherMatch(file, teacher);
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    filteredFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = 'playlist-item';
      
      // 检查是否是当前播放的视频
      const currentSrc = this.dom.mainVideo.src;
      // 注意：src 是 blob URL，这里比较文件名可能不准，但我们可以存储当前播放的文件名
      if (this.state.currentVideoName === file.name) {
        item.classList.add('active');
      }

      item.textContent = file.name;
      item.title = file.name;
      
      item.onclick = () => {
        if (this.currentVideoUrl) URL.revokeObjectURL(this.currentVideoUrl);
        this.currentVideoUrl = URL.createObjectURL(file);
        this.state.currentVideoName = file.name;
        this.dom.mainVideo.src = this.currentVideoUrl;
        this.dom.mainVideo.play();
        if (this.dom.audioPlayer) this.dom.audioPlayer.pause();
        this.updatePlaylist();
      };
      
      this.dom.playlistItems.appendChild(item);
    });
  }

  bindLyrics() {
    if (this.lyricsBound || !this.dom.lyricsDisplay) return;
    this.lyricsBound = true;

    this.dom.lyricsDisplay.addEventListener('click', (event) => {
      const line = event.target.closest('.lyric-line');
      if (!line) return;
      this.handleLyricActivate(line);
    });

    this.dom.lyricsDisplay.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const line = event.target.closest('.lyric-line');
      if (!line) return;
      event.preventDefault();
      this.handleLyricActivate(line);
    });
  }

  bindPlayerControls() {
    if (
      !this.dom.playPauseBtn ||
      !this.dom.speedBtn ||
      !this.dom.progressBar ||
      !this.dom.audioPlayer ||
      !this.dom.playModeBtn
    ) {
      return;
    }

    this.dom.playPauseBtn.addEventListener('click', () => {
      if (this.dom.audioPlayer.paused) {
        this.safePlay();
      } else {
        this.dom.audioPlayer.pause();
      }
    });

    this.dom.speedBtn.addEventListener('click', () => {
      this.cyclePlaybackSpeed();
    });

    const seekByClientX = (clientX) => {
      if (!this.dom.audioPlayer.duration) return;
      const rect = this.dom.progressBar.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      this.dom.audioPlayer.currentTime = percent * this.dom.audioPlayer.duration;
    };

    this.dom.progressBar.addEventListener('click', (event) => {
      seekByClientX(event.clientX);
    });

    this.dom.progressBar.addEventListener('pointerdown', (event) => {
      this.state.isProgressDragging = true;
      this.dom.progressBar.classList.add('dragging');
      this.dom.progressBar.setPointerCapture(event.pointerId);
      seekByClientX(event.clientX);
    });

    this.dom.progressBar.addEventListener('pointermove', (event) => {
      if (!this.state.isProgressDragging) return;
      seekByClientX(event.clientX);
    });

    this.dom.progressBar.addEventListener('pointerup', (event) => {
      this.state.isProgressDragging = false;
      this.dom.progressBar.classList.remove('dragging');
      this.dom.progressBar.releasePointerCapture(event.pointerId);
    });

    this.dom.progressBar.addEventListener('pointercancel', () => {
      this.state.isProgressDragging = false;
      this.dom.progressBar.classList.remove('dragging');
    });

    this.dom.progressBar.addEventListener('pointerleave', () => {
      this.state.isProgressDragging = false;
      this.dom.progressBar.classList.remove('dragging');
    });

    this.dom.playModeBtn.addEventListener('click', () => {
      this.togglePlayMode();
    });

    this.dom.audioPlayer.addEventListener('timeupdate', () => {
      this.checkSinglePlayEnd();
      this.updateLyricHighlight();
      this.updateProgress();
    });

    this.dom.audioPlayer.addEventListener('loadedmetadata', () => {
      this.updateDuration();
    });

    this.dom.audioPlayer.addEventListener('canplay', () => {
      this.setPlayButtonDisabled(false);
    });

    this.dom.audioPlayer.addEventListener('loadstart', () => {
      this.setPlayButtonDisabled(true);
    });

    this.dom.audioPlayer.addEventListener('ended', () => {
      this.handleAudioEnded();
      this.updatePlayButton();
    });

    this.dom.audioPlayer.addEventListener('play', () => {
      if (this.dom.mainVideo) this.dom.mainVideo.pause();
      this.updatePlayButton();
    });

    this.dom.mainVideo.addEventListener('play', () => {
      if (this.dom.audioPlayer) this.dom.audioPlayer.pause();
    });

    this.dom.audioPlayer.addEventListener('pause', () => {
      this.state.singlePlayEndTime = null;
      this.updatePlayButton();
    });

    this.dom.audioPlayer.addEventListener('error', () => {
      this.setPlayButtonDisabled(true);
    });
  }

  bindNavigation() {
    if (this.dom.prevUnitBtn) {
      this.dom.prevUnitBtn.addEventListener('click', () => {
        this.loadPreviousUnit();
      });
    }

    if (this.dom.nextUnitBtn) {
      this.dom.nextUnitBtn.addEventListener('click', () => {
        this.loadNextUnit();
      });
    }
  }
}

// 初始化系统
document.addEventListener('DOMContentLoaded', () => {
  new ReadingSystem();
  initThemeToggle();
});

// 主题切换功能
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDark.matches)) {
    document.body.classList.add('dark-theme');
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    themeToggle.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      themeToggle.style.transform = '';
    }, 300);
  });

  prefersDark.addEventListener('change', (event) => {
    if (!localStorage.getItem('theme')) {
      if (event.matches) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
  });
}

// LRC 解析器
class LRCParser {
  static parse(lrcText) {
    const lines = lrcText.split('\n');
    const lyrics = [];

    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.+)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const time = minutes * 60 + seconds + milliseconds / 1000 - 0.5;

        // 分割英文和中文（使用 | 分隔符）
        const text = match[4].trim();
        const parts = text.split('|').map((p) => p.trim());

        lyrics.push({
          time,
          english: parts[0] || '',
          chinese: parts[1] || '',
          fullText: text
        });
      }
    }

    return lyrics.sort((a, b) => a.time - b.time);
  }
}
