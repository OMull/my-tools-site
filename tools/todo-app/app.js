// app.js
(() => {
  const MAX_LISTS  = 15;
  const DAYS       = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const SLOT_START = 7 * 60;   // minutes
  const SLOT_END   = 20 * 60;
  const SLOT_INT   = 15;

  let boardData  = { lists: [] };
  let activeCard = null;

  // — State persistence —
  function loadState() {
    const raw = localStorage.getItem('boardData');
    boardData = raw ? JSON.parse(raw) : { lists: [] };
    boardData.lists.forEach(list =>
      list.cards.forEach(card => {
        if (!card.scheduled) card.scheduled = [];
        if (!card.segments)  card.segments  = [{ type: 'work', length: card.duration || 30 }];
        if (!card.color)     card.color     = '#0079bf';
        if (!card.tags)      card.tags      = [];
        card.duration = card.segments.reduce((sum, seg) => sum + seg.length, 0);
      })
    );
  }
  function saveState() {
    localStorage.setItem('boardData', JSON.stringify(boardData));
  }
  function uuid() {
    return '_' + Math.random().toString(36).substr(2,9);
  }

  // — Export / Import —
  function exportData() {
    const blob = new Blob([JSON.stringify(boardData,null,2)],{type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'boardData.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imp = JSON.parse(reader.result);
        if (imp.lists && Array.isArray(imp.lists)) {
          boardData = imp;
          saveState();
          render(); renderCalendar();
        } else {
          alert('Invalid JSON');
        }
      } catch {
        alert('Parse error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // — Filtering helpers —
  function getFilterTags() {
    return document.getElementById('filter-input').value
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  function matchesFilter(card, filters) {
    if (!filters.length) return true;
    return card.tags.some(t => filters.includes(t.toLowerCase()));
  }

  // — List & Card operations —
  function addList() {
    if (boardData.lists.length >= MAX_LISTS) {
      alert('Maximum lists reached');
      return;
    }
    const title = prompt('List title:');
    if (!title) return;
    boardData.lists.push({ id: uuid(), title, cards: [] });
    saveState(); render(); renderCalendar();
  }
  function deleteList(listId) {
    boardData.lists = boardData.lists.filter(l => l.id !== listId);
    saveState(); render(); renderCalendar();
  }
  function addCard(listId) {
    const list = boardData.lists.find(l => l.id === listId);
    const title = prompt('Card title:');
    if (!title) return;
    list.cards.push({
      id: uuid(),
      title,
      checklist: [],
      segments: [{ type:'work', length:30 }],
      duration: 30,
      completed: false,
      scheduled: [],
      color: '#0079bf',
      tags: []
    });
    saveState(); render(); renderCalendar();
  }
  function deleteCard(listId, cardId) {
    const list = boardData.lists.find(l => l.id === listId);
    list.cards = list.cards.filter(c => c.id !== cardId);
    saveState(); render(); renderCalendar();
  }
  function toggleCardCompleted(listId, cardId, checked) {
    const list = boardData.lists.find(l => l.id === listId);
    const idx  = list.cards.findIndex(c => c.id === cardId);
    const card = list.cards[idx];
    card.completed = checked;
    if (checked) {
      list.cards.splice(idx,1);
      list.cards.push(card);
    }
    saveState(); render(); renderCalendar();
  }
  function updateCardOrder() {
    document.querySelectorAll('.list').forEach(listEl => {
      const list = boardData.lists.find(l => l.id === listEl.dataset.id);
      list.cards = Array.from(listEl.querySelectorAll('.card')).map(el =>
        list.cards.find(c => c.id === el.dataset.id)
      );
    });
    saveState(); renderCalendar();
  }

  // — Render Board (lists + cards) —
  function render() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    const filters = getFilterTags();

    boardData.lists.forEach(list => {
      const listEl = document.createElement('div');
      listEl.className = 'list';
      listEl.dataset.id = list.id;

      // header
      const hd = document.createElement('div');
      hd.className = 'list-header';
      const ttl = document.createElement('span');
      ttl.textContent = list.title;
      const delL = document.createElement('button');
      delL.textContent = '×';
      delL.onclick = () => deleteList(list.id);
      hd.append(ttl, delL);
      listEl.append(hd);

      // cards
      const cardsEl = document.createElement('div');
      cardsEl.className = 'cards';

      list.cards.forEach(card => {
        if (!matchesFilter(card, filters)) return;

        const ce = document.createElement('div');
        ce.className = 'card';
        ce.dataset.id = card.id;
        ce.draggable = true;
        ce.style.borderLeftColor = card.color;
        if (card.completed) ce.classList.add('completed');
        if (card.scheduled.length) {
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.style.background = card.color;
          ce.append(dot);
        }

        // native dragstart payload
        ce.addEventListener('dragstart', e => {
          const payload = JSON.stringify({ listId: list.id, cardId: card.id });
          e.dataTransfer.setData('application/json', payload);
          e.dataTransfer.setData('text/plain', payload);
        });

        // reorder handle
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '≡';
        ce.append(handle);

        // checkbox
        const chk = document.createElement('input');
        chk.type    = 'checkbox';
        chk.checked = card.completed;
        chk.onchange = e =>
          toggleCardCompleted(list.id, card.id, e.target.checked);

        // title
        const sp = document.createElement('span');
        sp.className = 'title';
        sp.textContent = card.title;

        // duration
        const du = document.createElement('span');
        du.className = 'duration';
        du.textContent = card.duration + 'm';

        // schedule button
        const sb = document.createElement('button');
        sb.textContent = '📅';
        sb.title = 'Schedule';
        sb.onclick = e => {
          e.stopPropagation();
          ce.classList.add('selected');
          activeCard = { listId: list.id, cardId: card.id };
        };

        ce.addEventListener('click', e => {
          if (e.target===chk || e.target===sb) return;
          openCardModal(list.id, card.id);
        });

        ce.append(chk, sp, du, sb);
        cardsEl.append(ce);
      });

      new Sortable(cardsEl, {
        group: 'board',
        animation: 150,
        handle: '.drag-handle',
        onEnd: updateCardOrder
      });

      const addB = document.createElement('button');
      addB.textContent = '+';
      addB.onclick = () => addCard(list.id);

      listEl.append(cardsEl, addB);
      boardEl.append(listEl);
    });
  }

  // — Render Calendar with absolute positioning & patterns —
  function renderCalendar() {
    const cal = document.getElementById('calendar');
    cal.innerHTML = '';
    cal.style.position = 'relative';
    cal.style.display  = 'grid';
    cal.style.gridTemplateColumns = `60px repeat(${DAYS.length},1fr)`;

    // build time slots
    const times = [];
    for (let t = SLOT_START; t <= SLOT_END; t += SLOT_INT) {
      const h = Math.floor(t/60), m = t%60;
      times.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
    cal.style.gridTemplateRows = `auto repeat(${times.length},1fr)`;

    // header row
    cal.appendChild(document.createElement('div'));
    DAYS.forEach(d => {
      const hd = document.createElement('div');
      hd.className   = 'cell day-header';
      hd.textContent = d;
      cal.append(hd);
    });

    // time labels & drop targets
    times.forEach((ts,rowIdx) => {
      const lbl = document.createElement('div');
      lbl.className = 'cell time-label';
      lbl.textContent = ts.endsWith(':00') ? ts : '';
      cal.append(lbl);

      DAYS.forEach((_, dayIdx) => {
        const cell = document.createElement('div');
        cell.className = 'cell calendar-cell';
        cell.dataset.day  = dayIdx;
        cell.dataset.time = ts;

        cell.addEventListener('dragover', e => e.preventDefault());
        cell.addEventListener('drop', e => {
          e.preventDefault();
          let raw = e.dataTransfer.getData('application/json');
          if (!raw) raw = e.dataTransfer.getData('text/plain');
          try {
            const { listId, cardId } = JSON.parse(raw);
            const card = boardData.lists
              .find(l => l.id === listId)
              .cards.find(c => c.id === cardId);
            if (!card.scheduled.some(s => s.day===dayIdx && s.time===ts)) {
              card.scheduled.push({ day: dayIdx, time: ts });
              saveState(); render(); renderCalendar();
            }
          } catch {
            // ignore invalid payload
          }
        });

        cal.append(cell);
      });
    });

    // measurements
    const rect      = cal.getBoundingClientRect();
    const headerH   = cal.querySelector('.day-header').offsetHeight;
    const firstColW = cal.querySelector('.time-label').offsetWidth;
    const slotH     = (rect.height - headerH) / times.length;
    const colW      = (rect.width - firstColW) / DAYS.length;

    // place events per segment
    const filters = getFilterTags();
    boardData.lists.forEach(list =>
      list.cards.forEach(card => {
        if (!matchesFilter(card, filters)) return;
        card.scheduled.forEach(s => {
          const dayIdx = s.day;
          const slotIdx = times.indexOf(s.time);
          if (slotIdx < 0) return;
          let offset = 0;
          card.segments.forEach(seg => {
            const span = Math.ceil(seg.length / SLOT_INT);
            const ev   = document.createElement('div');
            ev.className = 'event';
            if (seg.type === 'work') {
              ev.textContent   = card.title;
              ev.style.background = card.color;
              ev.style.opacity    = card.completed ? '0.5' : '1';
            } else {
              ev.classList.add('wait-pattern');
            }
            ev.style.position = 'absolute';
            ev.style.left     = `${firstColW + dayIdx*colW}px`;
            ev.style.top      = `${headerH + (slotIdx+offset)*slotH}px`;
            ev.style.width    = `${colW}px`;
            ev.style.height   = `${span*slotH}px`;
            ev.style.pointerEvents = 'none';
            cal.append(ev);
            offset += span;
          });
        });
      })
    );
  }

  // — Modal, segments, tags & checklist —
  function openCardModal(listId, cardId) {
    const c = boardData.lists
      .find(l => l.id===listId)
      .cards.find(x => x.id===cardId);
    activeCard = { listId, cardId };

    document.getElementById('modal-title').textContent = c.title;
    document.getElementById('seg-work1').value = c.segments[0].length;
    document.getElementById('seg-wait').value  = c.segments[1]?.length || 0;
    document.getElementById('seg-work2').value = c.segments[2]?.length || 0;
    document.getElementById('color-input').value = c.color;
    document.getElementById('tags-input').value  = c.tags.join(', ');

    renderChecklist(c.checklist);
    document.getElementById('card-modal').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('card-modal').classList.add('hidden');
    activeCard = null;
  }
  function renderChecklist(items) {
    const ul = document.getElementById('checklist');
    ul.innerHTML = '';
    items.forEach(i => {
      const li = document.createElement('li');
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = i.checked;
      chk.onchange = () => toggleChecklistItem(i.id);
      const sp = document.createElement('span'); sp.textContent = i.text;
      const del = document.createElement('button'); del.textContent = '×';
      del.onclick = () => removeChecklistItem(i.id);
      li.append(chk, sp, del);
      ul.append(li);
    });
  }
  function addChecklistItem() {
    const inp = document.getElementById('check-item-input'), txt = inp.value.trim();
    if (!txt || !activeCard) return;
    const c = boardData.lists
      .find(l => l.id === activeCard.listId)
      .cards.find(x => x.id === activeCard.cardId);
    c.checklist.push({ id: uuid(), text: txt, checked: false });
    inp.value = ''; saveState(); renderChecklist(c.checklist);
  }
  function toggleChecklistItem(id) {
    const c = boardData.lists
      .find(l => l.id === activeCard.listId)
      .cards.find(x => x.id === activeCard.cardId);
    const it = c.checklist.find(x => x.id === id);
    it.checked = !it.checked; saveState(); renderChecklist(c.checklist);
  }
  function removeChecklistItem(id) {
    const c = boardData.lists
      .find(l => l.id === activeCard.listId)
      .cards.find(x => x.id === activeCard.cardId);
    c.checklist = c.checklist.filter(x => x.id !== id);
    saveState(); renderChecklist(c.checklist);
  }

  // update segments
  function updateSegments() {
    if (!activeCard) return;
    const c = boardData.lists
      .find(l => l.id === activeCard.listId)
      .cards.find(x => x.id === activeCard.cardId);
    const w1 = +document.getElementById('seg-work1').value || 0;
    const wt = +document.getElementById('seg-wait').value  || 0;
    const w2 = +document.getElementById('seg-work2').value || 0;
    c.segments = (wt>0 && w2>0)
      ? [{type:'work',length:w1},{type:'wait',length:wt},{type:'work',length:w2}]
      : [{type:'work',length:w1}];
    c.duration = c.segments.reduce((sum, seg) => sum + seg.length, 0);
    saveState(); render(); renderCalendar();
  }
  document.getElementById('seg-work1').onchange = updateSegments;
  document.getElementById('seg-wait').onchange  = updateSegments;
  document.getElementById('seg-work2').onchange = updateSegments;

  // update tags
  document.getElementById('tags-input').onchange = () => {
    if (!activeCard) return;
    const c = boardData.lists
      .find(l => l.id === activeCard.listId)
      .cards.find(x => x.id === activeCard.cardId);
    c.tags = document.getElementById('tags-input')
               .value.split(',').map(s=>s.trim()).filter(Boolean);
    saveState(); render(); renderCalendar();
  };

  // color change
  document.getElementById('color-input').onchange = function() {
    if (!activeCard) return;
    const c = boardData.lists
      .find(l => l.id === activeCard.listId)
      .cards.find(x => x.id === activeCard.cardId);
    c.color = this.value; saveState(); render(); renderCalendar();
  };

  // delete card
  document.getElementById('delete-card-btn').onclick = () => {
    if (!activeCard) return;
    deleteCard(activeCard.listId, activeCard.cardId);
    closeModal();
  };

  // — Wire controls —
  document.getElementById('add-list-btn').onclick       = addList;
  document.getElementById('export-btn').onclick         = exportData;
  document.getElementById('import-btn').onclick         = () => document.getElementById('import-json').click();
  document.getElementById('import-json').onchange       = importData;
  document.getElementById('filter-input').onchange      = () => { render(); renderCalendar(); };
  document.getElementById('modal-close').onclick        = closeModal;
  document.getElementById('add-check-item-btn').onclick = addChecklistItem;
  document.getElementById('check-item-input').addEventListener('keydown',
    e => { if (e.key==='Enter') addChecklistItem(); }
  );

  // — Initialize —
  loadState(); render(); renderCalendar();
})();
