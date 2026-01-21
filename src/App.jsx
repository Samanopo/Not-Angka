import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import html2canvas from 'html2canvas';
import { Midi } from '@tonejs/midi';

// --- KONFIGURASI VISUAL ---
const CONFIG = {
  baseSpacing: 55,     
  voiceSpacing: 80,    
  systemSpacing: 150,  
  startX: 130, // <--- UBAH INI: Memberi jarak lebih lebar untuk label SATB (tadinya 80)
  startY: 80
};

// --- KONFIGURASI BIRAMA ---
const TIME_CONFIG = {
  "4/4": { limit: 4, groupSize: 4 }, 
  "3/4": { limit: 3, groupSize: 6 }, 
  "2/4": { limit: 2, groupSize: 4 }, 
  "6/8": { limit: 3, groupSize: 3 }, 
  "2/2": { limit: 4, groupSize: 4 }  
};

// --- DATA NADA ---
const KEY_SIGNATURES = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
const GM_INSTRUMENTS = { 'Piano': 0, 'Organ': 19, 'Violin': 40, 'Flute': 73, 'Bass': 32, 'Synth': 80 };

// --- INSTRUMEN AUDIO ---
const INSTRUMENTS = {
  'Piano': { type: Tone.Synth, options: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }, octaveOffset: 0 },
  'Organ': { type: Tone.AMSynth, options: { harmonicity: 3, modulationIndex: 2, envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.5 } }, octaveOffset: 0 },
  'Violin': { type: Tone.FMSynth, options: { harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.2, decay: 0.3, sustain: 0.8, release: 1 } }, octaveOffset: 0 },
  'Flute': { type: Tone.MonoSynth, options: { oscillator: { type: "sine" }, envelope: { attack: 0.1, decay: 0.4, sustain: 0.8, release: 0.8 }, filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 0.8, baseFrequency: 200, octaves: 4 } }, octaveOffset: 1 },
  'Bass': { type: Tone.MembraneSynth, options: { octaves: 5, pitchDecay: 0.1 }, octaveOffset: -2 },
  'Synth': { type: Tone.DuoSynth, options: { vibratoAmount: 0.5, vibratoRate: 5, harmonicity: 1.5 }, octaveOffset: 0 }
};

// --- KOMPONEN NOT ---
const CipherNote = ({ note, x, y, isSelected, isPlaying, onClick, isActiveTrack }) => {
  const fontSize = 24;
  const staccatoY = y - 40; 
  
  let numberColor = isActiveTrack ? "black" : "#bbb";
  let boxFill = "transparent";
  let boxStroke = "transparent";

  if (isSelected && isActiveTrack) {
      numberColor = "#2E7D32"; 
      boxFill = "rgba(76, 175, 80, 0.1)";
      boxStroke = "#4CAF50";
  }
  if (isPlaying) numberColor = "#D50000"; 

  const isNumber = typeof note.pitch === 'number';

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect x={x - 15} y={y - 50} width="30" height="90" fill={boxFill} stroke={boxStroke} strokeWidth="1" rx="4"/>
      <text x={x} y={y} fontSize={fontSize} fontFamily="monospace" textAnchor="middle" fontWeight={isActiveTrack ? "bold" : "normal"} fill={numberColor}>{note.isRest ? "0" : note.pitch}</text>
      
      {!note.isRest && isNumber && note.accidental === 'sharp' && (<line x1={x - 8} y1={y + 6} x2={x + 8} y2={y - 14} stroke={numberColor} strokeWidth="2" opacity="0.8" />)}
      {!note.isRest && isNumber && note.accidental === 'flat' && (<line x1={x - 8} y1={y - 14} x2={x + 8} y2={y + 6} stroke={numberColor} strokeWidth="2" opacity="0.8" />)}
      {!note.isRest && isNumber && note.octave > 0 && <circle cx={x} cy={y - 24} r="2.5" fill={numberColor} />}
      {!note.isRest && isNumber && note.octave < 0 && <circle cx={x} cy={y + 10} r="2.5" fill={numberColor} />}
      {note.staccato && !note.isRest && isNumber && (<circle cx={x} cy={staccatoY} r="2.5" fill={numberColor} />)}
      {note.beamBreak && isSelected && isActiveTrack && (<line x1={x - 10} y1={y-30} x2={x-10} y2={y-15} stroke="red" strokeWidth="1" strokeDasharray="2,2" />)}
      {note.lyric && (<text x={x} y={y + 35} fontSize="12" fontFamily="Arial" textAnchor="middle" fill="#666" style={{ fontStyle: "italic" }}>{note.lyric}</text>)}
    </g>
  );
};

// --- APLIKASI UTAMA ---
function App() {
  const [tracks, setTracks] = useState([
    { id: 1, name: "Sopran", instrument: "Piano", notes: [{ pitch: 1, octave: 0, duration: 1, isRest: false, slurLength: 0 }] },
    { id: 2, name: "Alto", instrument: "Piano", notes: [{ pitch: 3, octave: 0, duration: 1, isRest: false, slurLength: 0 }] },
    { id: 3, name: "Tenor", instrument: "Piano", notes: [{ pitch: 5, octave: 0, duration: 1, isRest: false, slurLength: 0 }] },
    { id: 4, name: "Bass", instrument: "Bass", notes: [{ pitch: 1, octave: -1, duration: 1, isRest: false, slurLength: 0 }] }
  ]);
  
  const [history, setHistory] = useState([]); 
  const [future, setFuture] = useState([]);   
  const [activeTrackIndex, setActiveTrackIndex] = useState(0); 
  const [meta, setMeta] = useState({ title: "Lagu Rohani", composer: "NN", tempo: 100, key: "C", timeSig: "4/4" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playingIndex, setPlayingIndex] = useState(null);
  
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const lyricInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const paperRef = useRef(null);
  const currentNotes = tracks[activeTrackIndex]?.notes || [];

  // JURUS PAKSA CSS RESET
  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.display = "block";
    document.body.style.placeItems = "unset";
    document.body.style.minWidth = "100%";
    document.body.style.maxWidth = "none";
    
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- LOGIC ---
  const updateTracksWithHistory = (newTracks) => { setHistory(p => [...p, JSON.parse(JSON.stringify(tracks))]); setFuture([]); setTracks(newTracks); };
  const handleUndo = () => { if (history.length===0) return; const prev=history[history.length-1]; setFuture(f=>[JSON.parse(JSON.stringify(tracks)), ...f]); setTracks(prev); setHistory(h=>h.slice(0,-1)); };
  const handleRedo = () => { if (future.length===0) return; const next=future[0]; setHistory(h=>[...h, JSON.parse(JSON.stringify(tracks))]); setTracks(next); setFuture(f=>f.slice(1)); };

  const updateNote = (idx, changes) => { 
    if (idx===null) return; 
    const n = [...tracks]; 
    if (!n[activeTrackIndex].notes[idx]) return;
    n[activeTrackIndex].notes[idx] = { ...n[activeTrackIndex].notes[idx], ...changes }; 
    updateTracksWithHistory(n); 
  };

  const handleAddNote = () => { 
    const n = [...tracks]; 
    n[activeTrackIndex].notes.push({ pitch: 1, octave: 0, duration: 1, isRest: false, lyric: "", slurLength: 0, staccato: false }); 
    updateTracksWithHistory(n); 
    setSelectedIndex(n[activeTrackIndex].notes.length-1); 
  };
  
  const addNewTrack = () => { const n = [...tracks]; n.push({ id: Date.now(), name: `Suara ${tracks.length + 1}`, instrument: "Piano", notes: [{ pitch: 1, octave: 0, duration: 1, isRest: false, slurLength: 0 }] }); updateTracksWithHistory(n); setActiveTrackIndex(n.length-1); setSelectedIndex(0); };
  const deleteTrack = (idx) => { if(tracks.length<=1)return; if(window.confirm("Hapus?")){ updateTracksWithHistory(tracks.filter((_,i)=>i!==idx)); setActiveTrackIndex(0); }};
  const renameTrack = (val) => { const n=[...tracks]; n[activeTrackIndex].name=val; setTracks(n); };
  const changeInstrument = (val) => { const n=[...tracks]; n[activeTrackIndex].instrument=val; setTracks(n); };

  // --- TOOLBAR FUNCTIONS ---
  const changeDuration = (dur) => selectedIndex !== null && updateNote(selectedIndex, { duration: dur });
  const changeOctave = (dir) => selectedIndex !== null && updateNote(selectedIndex, { octave: currentNotes[selectedIndex].octave + dir });
  const toggleBeamBreak = () => selectedIndex !== null && updateNote(selectedIndex, { beamBreak: !currentNotes[selectedIndex].beamBreak });
  const toggleStaccato = () => selectedIndex !== null && updateNote(selectedIndex, { staccato: !currentNotes[selectedIndex].staccato });
  const toggleAccidental = (type) => { if(selectedIndex !== null) updateNote(selectedIndex, { accidental: currentNotes[selectedIndex].accidental === type ? null : type }); };
  const toggleSlur = () => {
    if (selectedIndex === null) return;
    const current = currentNotes[selectedIndex].slurLength || 0;
    let nextLen = current + 1;
    if (nextLen > 3) nextLen = 0; 
    updateNote(selectedIndex, { slurLength: nextLen });
  };

  // --- AUDIO ENGINE ---
  const playMusic = async () => {
    Tone.Transport.cancel(); await Tone.start(); Tone.Transport.bpm.value = meta.tempo; const keyShift = KEY_SIGNATURES[meta.key]||0;
    tracks.forEach((t, tIdx) => {
      const inst = INSTRUMENTS[t.instrument]||INSTRUMENTS['Piano']; 
      const synth = new Tone.PolySynth(inst.type, inst.options).toDestination();
      let time = Tone.Transport.now()+0.1;
      
      t.notes.forEach((n, nIdx) => {
        if(typeof n.pitch === 'number' && !n.isRest){
          let totalDuration = n.duration;
          for(let i = nIdx + 1; i < t.notes.length; i++) {
             if (t.notes[i].pitch === ".") {
                totalDuration += t.notes[i].duration;
             } else {
                break; 
             }
          }
          const notes=['C','D','E','F','G','A','B']; const name=notes[Math.max(0,n.pitch-1)];
          let freq=Tone.Frequency(name+(4+n.octave+(inst.octaveOffset||0))).transpose(keyShift);
          if(n.accidental==='sharp') freq.transpose(1); if(n.accidental==='flat') freq.transpose(-1);
          synth.triggerAttackRelease(freq, (n.staccato?0.5:1)*Tone.Time("4n").toSeconds()*totalDuration, time);
        }
        if(tIdx === activeTrackIndex) Tone.Draw.schedule(()=>setPlayingIndex(nIdx), time);
        time+=Tone.Time("4n").toSeconds()*n.duration;
      });
    });
    Tone.Transport.start();
  };

  const handleExportMIDI = () => {
    const midi = new Midi(); midi.name = meta.title; midi.header.setTempo(meta.tempo);
    tracks.forEach(t => {
        const tr = midi.addTrack(); tr.name = t.name; tr.instrument.number = GM_INSTRUMENTS[t.instrument]||0;
        let time=0;
        t.notes.forEach((n, nIdx) => {
            const beatDur = 60/meta.tempo;
            let currentDur = beatDur * n.duration;
            if(typeof n.pitch === 'number' && !n.isRest){
                let totalBeats = n.duration;
                for(let i = nIdx + 1; i < t.notes.length; i++) {
                   if (t.notes[i].pitch === ".") totalBeats += t.notes[i].duration;
                   else break;
                }
                const scale=[0,2,4,5,7,9,11]; const base=scale[Math.max(0,n.pitch-1)];
                let mn=60+base+(n.octave*12)+(KEY_SIGNATURES[meta.key]||0);
                if(n.accidental==='sharp')mn+=1; if(n.accidental==='flat')mn-=1;
                tr.addNote({ midi: mn, time: time, duration: beatDur * totalBeats, velocity: 0.8 });
            }
            time+=currentDur;
        });
    });
    const blob = new Blob([midi.toArray()], {type:'audio/midi'}); const l=document.createElement('a'); l.href=URL.createObjectURL(blob); l.download=`${meta.title}.mid`; document.body.appendChild(l); l.click(); l.remove();
  };

  // --- LAYOUT ENGINE (PERBAIKAN TINGGI GARIS BIRAMA) ---
  const calculateScoreLayout = () => {
    const guideTrack = tracks[activeTrackIndex] || tracks[0];
    const notes = guideTrack.notes;

    let currentX = CONFIG.startX; 
    let currentY = CONFIG.startY; 
    let beatCounter = 0; 
    const timeSigData = TIME_CONFIG[meta.timeSig] || TIME_CONFIG["4/4"];
    const beatsPerBar = timeSigData.limit;
    let barsOnLine = 0; 

    let layoutElements = [];
    const systemHeight = (tracks.length - 1) * CONFIG.voiceSpacing;

    // --- HELPER: Menggambar Garis Birama Tinggi Penuh ---
    // y1: currentY - 30 (Naik sedikit di atas Sopran)
    // y2: currentY + systemHeight + 10 (Turun sedikit di bawah Bass)
    const addBarline = (xPos) => {
        layoutElements.push({ 
            type: 'barline', 
            x: xPos, 
            y1: currentY - 30,  // <--- PERBAIKAN: Lebih tinggi dari not Sopran
            y2: currentY + systemHeight + 10  // <--- PERBAIKAN: Sampai bawah Bass
        });
    };

    // Label & Garis Awal
    tracks.forEach((t, i) => { layoutElements.push({ type: 'label', text: t.name, x: 10, y: currentY + (i * CONFIG.voiceSpacing) }); });
    addBarline(currentX - 25);

    notes.forEach((noteRef, index) => {
        const lyricLength = noteRef.lyric ? noteRef.lyric.length * 8 : 0; 
        const requiredSpace = Math.max(CONFIG.baseSpacing, lyricLength + 15);
        let nextSpacing = requiredSpace;
        if (noteRef.duration < 0.5) nextSpacing = CONFIG.baseSpacing * 0.8;

        tracks.forEach((track, trackIdx) => {
            const note = track.notes[index]; 
            if (note) {
                layoutElements.push({ ...note, type: 'note', x: currentX, y: currentY + (trackIdx * CONFIG.voiceSpacing), originalIndex: index, trackIndex: trackIdx });
            }
        });

        beatCounter += noteRef.duration; 
        let extraGap = 0; 

        if (beatCounter >= beatsPerBar - 0.01) {
            const barLineX = currentX + (requiredSpace / 2) + 20; 
            addBarline(barLineX); // Gunakan helper barline tinggi
            
            beatCounter = 0; 
            barsOnLine++; 

            if (barsOnLine >= 4) {
                currentY += systemHeight + CONFIG.systemSpacing; 
                currentX = CONFIG.startX; 
                barsOnLine = 0; 
                
                tracks.forEach((t, i) => { layoutElements.push({ type: 'label', text: t.name, x: 10, y: currentY + (i * CONFIG.voiceSpacing) }); });
                addBarline(currentX - 25); // Barline awal sistem baru
                currentX -= (nextSpacing + extraGap); 
            } else {
                extraGap = 30; 
            }
        }
        
        currentX += nextSpacing + extraGap;
    });

    return { elements: layoutElements, totalHeight: currentY + systemHeight + 200 };
  };

  const { elements, totalHeight } = calculateScoreLayout();
  const renderedNotes = elements.filter(e => e.type === 'note');
  const lastNote = renderedNotes.filter(n => n.trackIndex === activeTrackIndex).pop();
  let addButtonX = lastNote ? lastNote.x + 50 : CONFIG.startX;
  let addButtonY = lastNote ? lastNote.y : CONFIG.startY + (activeTrackIndex * CONFIG.voiceSpacing);
  if (addButtonX > 1000) { addButtonX = CONFIG.startX; addButtonY += CONFIG.systemSpacing; }

  const renderBeams = () => {
    const beams = [];
    const groupSize = (TIME_CONFIG[meta.timeSig] || TIME_CONFIG["4/4"]).groupSize;
    tracks.forEach((_, tIdx) => {
        const trackNotes = renderedNotes.filter(n => n.trackIndex === tIdx);
        const createBeamGroups = (threshold, yOffset) => {
            let groupStart = null;
            let countInGroup = 0;
            trackNotes.forEach((note, i) => {
                const isNum = typeof note.pitch === 'number';
                const eligible = !note.isRest && isNum && note.duration <= threshold;
                const prev = trackNotes[i-1];
                const isBreak = prev && note.y !== prev.y; 
                const isManualBreak = note.beamBreak; 
                const shouldBreakGroup = isBreak || isManualBreak || countInGroup >= groupSize;

                if (shouldBreakGroup) {
                    if (groupStart !== null) {
                        const s = trackNotes[groupStart]; const e = trackNotes[i-1];
                        if (s !== e) {
                           beams.push(<line key={`b-${tIdx}-${threshold}-${groupStart}`} x1={s.x-10} y1={s.y-yOffset} x2={e.x+10} y2={e.y-yOffset} stroke="black" strokeWidth="4" />);
                        }
                        groupStart = null;
                        countInGroup = 0;
                    }
                }
                if (eligible) {
                    if (groupStart === null) groupStart = i;
                    countInGroup++;
                } else {
                    if (groupStart !== null) {
                        const s = trackNotes[groupStart]; const e = trackNotes[i-1];
                        if (s !== e) {
                           beams.push(<line key={`b-${tIdx}-${threshold}-${groupStart}`} x1={s.x-10} y1={s.y-yOffset} x2={e.x+10} y2={e.y-yOffset} stroke="black" strokeWidth="4" />);
                        }
                        groupStart = null;
                        countInGroup = 0;
                    }
                }
            });
            if (groupStart !== null) {
                const s = trackNotes[groupStart]; const e = trackNotes[trackNotes.length - 1];
                if (s !== e) {
                   beams.push(<line key={`b-${tIdx}-${threshold}-${groupStart}-end`} x1={s.x-10} y1={s.y-yOffset} x2={e.x+10} y2={e.y-yOffset} stroke="black" strokeWidth="4" />);
                }
            }
        };
        createBeamGroups(0.5, 32); 
        createBeamGroups(0.25, 40); 
    });
    return beams;
  };

  const renderSlurs = () => {
      const slurs = [];
      tracks.forEach((_, tIdx) => {
          const trackNotes = renderedNotes.filter(n => n.trackIndex === tIdx);
          trackNotes.forEach((n, i) => {
            const len = n.slurLength || 0;
            if (len > 0) {
              const targetIndex = i + len; 
              if (targetIndex < trackNotes.length) {
                 const target = trackNotes[targetIndex];
                 if (n.y === target.y) {
                    const sx = n.x; const sy = n.y - 55; const ex = target.x; const ey = target.y - 55;
                    slurs.push(<path key={`s-${tIdx}-${i}`} d={`M ${sx} ${sy} Q ${(sx+ex)/2} ${sy-40} ${ex} ${ey}`} stroke="black" strokeWidth="1.5" fill="none"/>);
                 }
              }
            }
          });
      });
      return slurs;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; 
      const key = e.key.toLowerCase();
      if (e.shiftKey && e.key === 'ArrowDown') { setActiveTrackIndex(p => Math.min(p+1, tracks.length-1)); return; }
      if (e.shiftKey && e.key === 'ArrowUp') { setActiveTrackIndex(p => Math.max(0, p-1)); return; }
      if (selectedIndex === null) return;
      if (['1','2','3','4','5','6','7'].includes(key)) updateNote(selectedIndex, { pitch: parseInt(key), isRest: false });
      if (key==='0') updateNote(selectedIndex, { isRest: true });
      if (key==='.') updateNote(selectedIndex, { pitch: ".", isRest: false });
      if (e.key==='ArrowRight') setSelectedIndex(p => Math.min(p+1, tracks[activeTrackIndex].notes.length-1));
      if (e.key==='ArrowLeft') setSelectedIndex(p => Math.max(0, p-1));
      if (e.key==='Enter') handleAddNote();
      if (e.key==='Backspace') { const n=[...tracks]; n[activeTrackIndex].notes.splice(selectedIndex,1); updateTracksWithHistory(n); setSelectedIndex(p=>Math.max(0,p-1)); }
      if (e.key===' ') { e.preventDefault(); playMusic(); }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, activeTrackIndex, selectedIndex, meta]);

  const saveProject = () => { const dl = document.createElement('a'); dl.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ meta, tracks })); dl.download = meta.title + ".json"; dl.click(); };
  const triggerLoad = () => fileInputRef.current.click();
  const handleFileChange = (e) => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{const d=JSON.parse(ev.target.result); if(d.tracks) setTracks(d.tracks); setMeta(d.meta||{title:"Unt", composer:"", tempo:100, key:"C", timeSig:"4/4"}); }catch(e){alert("Err");} }; r.readAsText(f); e.target.value=null; };
  const handleExportImage = async () => { if(paperRef.current) { setSelectedIndex(null); const c = await html2canvas(paperRef.current, { scale: 2, backgroundColor: "#ffffff" }); const l = document.createElement("a"); l.href = c.toDataURL("image/png"); l.download = "partitur.png"; l.click(); } };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", backgroundColor: "#f4f4f9", minHeight: "100vh", width: "100vw", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ position: "sticky", top: "10px", zIndex: 100, background: "white", padding: "10px 20px", borderRadius: "10px", boxShadow: "0 5px 20px rgba(0,0,0,0.1)", marginBottom: "20px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={playMusic} style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#4CAF50", color: "white", border: "none", fontSize: "16px", cursor: "pointer", paddingLeft: "15px" }}>▶</button>
            <input ref={lyricInputRef} type="text" value={tracks[activeTrackIndex].notes[selectedIndex]?.lyric || ""} onChange={(e)=>updateNote(selectedIndex, {lyric: e.target.value})} placeholder="Lirik (Track Aktif)..." style={{ border: "1px solid #ccc", borderRadius: "5px", padding: "8px", width: "150px" }}/>
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
             <button onClick={handleUndo} style={{ padding: "5px 10px" }}>↩</button>
             <button onClick={handleRedo} style={{ padding: "5px 10px" }}>↪</button>
             <button onClick={saveProject} style={{ background: "#607D8B", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px" }}>💾</button>
             <button onClick={handleExportImage} style={{ background: "#FF9800", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px" }}>📷</button>
             <button onClick={handleExportMIDI} style={{ background: "#3F51B5", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", fontWeight: "bold" }}>🎹</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "5px", overflowX: "auto", paddingBottom: "10px", borderBottom: "1px solid #eee" }}>
            {tracks.map((track, idx) => ( <button key={track.id} onClick={() => { setActiveTrackIndex(idx); setSelectedIndex(0); }} style={{ padding: "5px 15px", border: "none", cursor: "pointer", background: activeTrackIndex === idx ? "#2196F3" : "#e0e0e0", color: activeTrackIndex === idx ? "white" : "#666", borderRadius: "20px", fontWeight: "bold" }}>{track.name}</button> ))}
            <button onClick={addNewTrack} style={{ padding: "5px 10px", borderRadius: "20px", border: "1px dashed #999", background: "white", cursor: "pointer" }}>+ Suara</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", flexWrap: "wrap", gap: "10px", background: "#E3F2FD", padding: "10px", borderRadius: "5px" }}>
           <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
              <select value={tracks[activeTrackIndex].instrument||'Piano'} onChange={(e)=>changeInstrument(e.target.value)} style={{border:"1px solid #1976D2", borderRadius:"4px", padding:"5px"}}>{Object.keys(INSTRUMENTS).map(k=><option key={k} value={k}>{k}</option>)}</select>
              <input type="text" value={tracks[activeTrackIndex].name} onChange={(e) => renameTrack(e.target.value)} style={{ border: "1px solid #90CAF9", padding: "5px", borderRadius: "4px", width: "80px" }}/>
              <button onClick={() => deleteTrack(activeTrackIndex)} style={{ background: "#FFCDD2", color: "#C62828", border: "none", padding: "5px 10px", borderRadius: "4px" }}>Hapus</button>
           </div>
           
           <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                <button onClick={() => changeOctave(1)} style={{ padding: "2px 8px", cursor: "pointer" }}>⬆</button>
                <button onClick={() => changeOctave(-1)} style={{ padding: "2px 8px", cursor: "pointer" }}>⬇</button>
                <div style={{width: "1px", background:"#bbb", margin: "0 5px"}}></div>
                
                <button onClick={() => updateNote(selectedIndex, { pitch: ".", duration: 1, isRest: false })} style={{ padding: "2px 8px", cursor: "pointer", fontWeight: "bold", fontSize: "18px" }}>.</button>
                
                <button onClick={() => changeDuration(0.5)} style={{ padding: "2px 8px", cursor: "pointer" }}>1/8</button>
                <button onClick={() => changeDuration(0.25)} style={{ padding: "2px 8px", cursor: "pointer" }}>1/16</button>
                <button onClick={toggleBeamBreak} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.beamBreak ? "#FFAB91" : "#f0f0f0", fontWeight: "bold" }}>||</button>
                <div style={{width: "1px", background:"#bbb", margin: "0 5px"}}></div>
                <button onClick={toggleSlur} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.slurLength > 0 ? "#BBDEFB" : "#f0f0f0", fontWeight: "bold" }}>⌒</button>
                <button onClick={toggleStaccato} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.staccato ? "#E1BEE7" : "#f0f0f0", fontWeight: "bold" }}>.</button>
                <div style={{width: "1px", background:"#bbb", margin: "0 5px"}}></div>
                <button onClick={() => toggleAccidental('sharp')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'sharp' ? "#FFF59D" : "#f0f0f0" }}>/</button>
                <button onClick={() => toggleAccidental('flat')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'flat' ? "#FFF59D" : "#f0f0f0" }}>\</button>
                <button onClick={handleAddNote} style={{ background: "#1976D2", color: "white", padding: "2px 10px", border: "none", borderRadius: "3px", cursor: "pointer" }}>+ Not</button>
           </div>
        </div>
      </div>
      <div ref={paperRef} style={{ background: "white", width: "100%", minHeight: "600px", padding: "40px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", borderRadius: "8px", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
          <input type="text" value={meta.title} onChange={(e)=>setMeta({...meta, title:e.target.value})} style={{fontSize: "32px", fontWeight:"bold", textAlign:"center", border:"none", width:"100%", outline:"none"}} />
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "10px" }} className="no-print"> 
             <select value={meta.key} onChange={(e) => setMeta({...meta, key: e.target.value})}>{Object.keys(KEY_SIGNATURES).map(k=><option key={k} value={k}>Do={k}</option>)}</select>
             <select value={meta.timeSig} onChange={(e) => setMeta({...meta, timeSig: e.target.value})}>
                {Object.keys(TIME_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display:'none'}} accept=".json" />
        <div className="no-print" style={{textAlign:"center", marginBottom: "10px"}}>
            <button onClick={triggerLoad} style={{background: "#f0f0f0", border: "1px solid #ccc", padding: "5px 15px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", color: "#555"}}>📂 Buka File Project (.json)</button>
        </div>
        <svg width="100%" height={totalHeight}>
          {elements.filter(e => e.type === 'barline').map((item, index) => ( <line key={`bar-${index}`} x1={item.x} y1={item.y1} x2={item.x} y2={item.y2} stroke="#ccc" strokeWidth="2" /> ))}
          {elements.filter(e => e.type === 'label').map((item, index) => ( <text key={`lbl-${index}`} x={item.x} y={item.y} fontSize="14" fill="#888" fontWeight="bold" dominantBaseline="middle">{item.text}</text> ))}
          {renderedNotes.map((item, i) => ( <CipherNote key={`note-${item.trackIndex}-${item.originalIndex}`} note={item} x={item.x} y={item.y} isActiveTrack={item.trackIndex === activeTrackIndex} isSelected={item.trackIndex === activeTrackIndex && item.originalIndex === selectedIndex} isPlaying={item.trackIndex === activeTrackIndex && item.originalIndex === playingIndex} onClick={() => { setActiveTrackIndex(item.trackIndex); setSelectedIndex(item.originalIndex); lyricInputRef.current.focus(); }} /> ))}
          {renderBeams()}
          {renderSlurs()}
          <g className="no-print" onClick={handleAddNote} style={{ cursor: "pointer", opacity: 0.6 }} onMouseEnter={(e)=>e.currentTarget.style.opacity=1} onMouseLeave={(e)=>e.currentTarget.style.opacity=0.6}>
            <circle cx={addButtonX} cy={addButtonY - 5} r="15" fill="#2196F3" />
            <text x={addButtonX} y={addButtonY} fill="white" fontSize="20" fontWeight="bold" textAnchor="middle" dy="6">+</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

export default App;