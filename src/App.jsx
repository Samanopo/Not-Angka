import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import html2canvas from 'html2canvas';
import { Midi } from '@tonejs/midi'; // IMPORT LIBRARY MIDI BARU

// --- KONFIGURASI VISUAL ---
const CONFIG = {
  baseSpacing: 60,
  lineHeight: 180,
  canvasWidth: 900,
  startX: 60,
  startY: 100
};

// --- DATA NADA & MIDI ---
const KEY_SIGNATURES = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
};

// General MIDI Program Numbers (Kode Instrumen Standar Internasional)
const GM_INSTRUMENTS = {
  'Piano': 0,   // Acoustic Grand Piano
  'Organ': 19,  // Church Organ
  'Violin': 40, // Violin
  'Flute': 73,  // Flute
  'Bass': 32,   // Acoustic Bass
  'Synth': 80   // Lead 1 (Square)
};

// --- INSTRUMEN AUDIO (BROWSER SOUND) ---
const INSTRUMENTS = {
  'Piano': { type: Tone.Synth, options: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }, octaveOffset: 0 },
  'Organ': { type: Tone.AMSynth, options: { harmonicity: 3, modulationIndex: 2, envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.5 } }, octaveOffset: 0 },
  'Violin': { type: Tone.FMSynth, options: { harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.2, decay: 0.3, sustain: 0.8, release: 1 } }, octaveOffset: 0 },
  'Flute': { type: Tone.MonoSynth, options: { oscillator: { type: "sine" }, envelope: { attack: 0.1, decay: 0.4, sustain: 0.8, release: 0.8 }, filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 0.8, baseFrequency: 200, octaves: 4 } }, octaveOffset: 1 },
  'Bass': { type: Tone.MembraneSynth, options: { octaves: 5, pitchDecay: 0.1 }, octaveOffset: -2 },
  'Synth': { type: Tone.DuoSynth, options: { vibratoAmount: 0.5, vibratoRate: 5, harmonicity: 1.5 }, octaveOffset: 0 }
};

// --- KOMPONEN NOT ---
const CipherNote = ({ note, x, y, isSelected, isPlaying, onClick }) => {
  const fontSize = 24;
  const staccatoY = y - 45; 
  let numberColor = "black";
  if (isSelected) numberColor = "#2E7D32"; 
  if (isPlaying) numberColor = "#D50000"; 

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect x={x - 20} y={y - 65} width="40" height="120" fill={isSelected ? "rgba(76, 175, 80, 0.1)" : "transparent"} stroke={isSelected ? "#4CAF50" : "transparent"} strokeWidth="1" rx="4" className="editor-ui"/>
      <text x={x} y={y} fontSize={fontSize} fontFamily="monospace" textAnchor="middle" fontWeight="bold" fill={numberColor}>{note.isRest ? "0" : note.pitch}</text>
      {!note.isRest && note.accidental === 'sharp' && (<line x1={x - 8} y1={y + 6} x2={x + 8} y2={y - 14} stroke={numberColor} strokeWidth="2.5" opacity="0.8" />)}
      {!note.isRest && note.accidental === 'flat' && (<line x1={x - 8} y1={y - 14} x2={x + 8} y2={y + 6} stroke={numberColor} strokeWidth="2.5" opacity="0.8" />)}
      {!note.isRest && note.octave > 0 && <circle cx={x} cy={y - 18} r="2.5" fill={numberColor} />}
      {!note.isRest && note.octave < 0 && <circle cx={x} cy={y + 10} r="2.5" fill={numberColor} />}
      {note.staccato && !note.isRest && (<circle cx={x} cy={staccatoY} r="2.5" fill={numberColor} />)}
      {note.beamBreak && isSelected && (<line x1={x - 15} y1={y-40} x2={x-15} y2={y-20} stroke="red" strokeWidth="1" strokeDasharray="2,2" />)}
      {note.lyric && (<text x={x} y={y + 35} fontSize="14" fontFamily="Arial" textAnchor="middle" fill="#444" style={{ fontStyle: "italic" }}>{note.lyric}</text>)}
    </g>
  );
};

function App() {
  const [tracks, setTracks] = useState([
    {
      id: 1,
      name: "Suara 1",
      instrument: "Piano",
      notes: [{ pitch: 1, octave: 0, duration: 1, isRest: false, lyric: "", slur: false, staccato: false, accidental: null, beamBreak: false }] 
    }
  ]);
  
  const [history, setHistory] = useState([]); 
  const [future, setFuture] = useState([]);   
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [meta, setMeta] = useState({ title: "Project Baru", composer: "User", tempo: 100, key: "C", timeSig: "4/4" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playingIndex, setPlayingIndex] = useState(null);
  const lyricInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const paperRef = useRef(null);
  const currentNotes = tracks[activeTrackIndex]?.notes || [];

  // --- HISTORY ---
  const updateTracksWithHistory = (newTracks) => {
    const currentSnapshot = JSON.parse(JSON.stringify(tracks));
    setHistory(prev => [...prev, currentSnapshot]);
    setFuture([]);
    setTracks(newTracks);
  };
  const handleUndo = () => { if (history.length===0) return; const prev=history[history.length-1]; setFuture(f=>[JSON.parse(JSON.stringify(tracks)), ...f]); setTracks(prev); setHistory(h=>h.slice(0,-1)); };
  const handleRedo = () => { if (future.length===0) return; const next=future[0]; setHistory(h=>[...h, JSON.parse(JSON.stringify(tracks))]); setTracks(next); setFuture(f=>f.slice(1)); };

  // --- TRACK ACTIONS ---
  const addNewTrack = () => { const newTracks = [...tracks]; newTracks.push({ id: Date.now(), name: `Suara ${tracks.length + 1}`, instrument: "Piano", notes: [{ pitch: 1, octave: 0, duration: 1, isRest: false, lyric: "", slur: false, beamBreak: false }] }); updateTracksWithHistory(newTracks); setActiveTrackIndex(newTracks.length - 1); setSelectedIndex(0); };
  const deleteTrack = (idx) => { if (tracks.length<=1) return alert("Minimal 1"); if(window.confirm("Hapus?")) { updateTracksWithHistory(tracks.filter((_,i)=>i!==idx)); setActiveTrackIndex(0); }};
  const renameTrack = (val) => { const n = [...tracks]; n[activeTrackIndex].name = val; setTracks(n); };
  const changeInstrument = (val) => { const n = [...tracks]; n[activeTrackIndex].instrument = val; setTracks(n); };

  // --- EXPORT MIDI (FITUR BARU) ---
  const handleExportMIDI = () => {
    // 1. Buat Objek MIDI Baru
    const midi = new Midi();
    midi.name = meta.title;
    
    // Set Tempo (ubah dari BPM ke Microseconds per beat otomatis oleh library)
    midi.header.setTempo(meta.tempo);

    // 2. Loop setiap Track (SATB)
    tracks.forEach(trackData => {
      // Tambah Track ke MIDI
      const track = midi.addTrack();
      track.name = trackData.name;
      
      // Set Instrumen (Program Change)
      const programNum = GM_INSTRUMENTS[trackData.instrument] || 0;
      track.instrument.number = programNum; 

      // Hitung Offset Nada (Key Signature + Instrument Octave)
      const keyShift = KEY_SIGNATURES[meta.key] || 0;
      const instConfig = INSTRUMENTS[trackData.instrument] || INSTRUMENTS['Piano'];
      const octaveShift = instConfig.octaveOffset || 0;

      let currentTime = 0; // Waktu dalam detik

      // 3. Loop setiap Note
      trackData.notes.forEach(note => {
        // Hitung durasi dalam detik (60 / BPM * ketuk)
        const durationSec = (60 / meta.tempo) * note.duration;

        if (!note.isRest) {
          // Mapping Angka ke MIDI Note Number
          // C4 (Middle C) = 60
          // Scale Relative Major: 1=0, 2=2, 3=4, 4=5, 5=7, 6=9, 7=11
          const scaleOffsets = [0, 2, 4, 5, 7, 9, 11]; // Do Re Mi Fa Sol La Si
          const baseOffset = scaleOffsets[Math.max(0, note.pitch - 1)]; 
          
          let midiNote = 60 + baseOffset + (note.octave * 12) + (octaveShift * 12) + keyShift;

          // Handle Accidental
          if (note.accidental === 'sharp') midiNote += 1;
          if (note.accidental === 'flat') midiNote -= 1;

          // Handle Staccato (Bunyi pendek, tapi waktu tetap jalan full)
          const playDuration = note.staccato ? durationSec * 0.5 : durationSec;

          // Tambahkan Note ke Track
          track.addNote({
            midi: midiNote,
            time: currentTime,
            duration: playDuration,
            velocity: 0.8 // Volume standar
          });
        }

        // Majukan waktu kursor
        currentTime += durationSec;
      });
    });

    // 4. Download File
    const arrayBuffer = midi.toArray();
    const blob = new Blob([arrayBuffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meta.title}.mid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- LAYOUT & RENDERERS ---
  const calculateLayout = () => {
    let currentX = CONFIG.startX; let currentY = CONFIG.startY; let beatCounter = 0; const beatsPerBar = parseInt(meta.timeSig.split('/')[0]);
    let layoutItems = []; layoutItems.push({ type: 'barline', x: currentX - 25, y: currentY });
    currentNotes.forEach((note, index) => {
      const lyricLength = note.lyric ? note.lyric.length * 9 : 0; const requiredSpace = Math.max(CONFIG.baseSpacing, lyricLength + 20);
      if (currentX + requiredSpace > CONFIG.canvasWidth - 50) { currentX = CONFIG.startX; currentY += CONFIG.lineHeight; layoutItems.push({ type: 'barline', x: currentX - 25, y: currentY }); }
      layoutItems.push({ ...note, type: 'note', x: currentX, y: currentY, originalIndex: index });
      beatCounter += note.duration; 
      if (beatCounter >= beatsPerBar) { layoutItems.push({ type: 'barline', x: currentX + (requiredSpace / 2) + 20, y: currentY }); beatCounter %= beatsPerBar; }
      let nextSpacing = requiredSpace; if (note.duration < 0.5 && lyricLength < 20) nextSpacing = CONFIG.baseSpacing * 0.9;
      currentX += nextSpacing;
    });
    return layoutItems;
  };
  const layoutData = calculateLayout();
  const renderedNotes = layoutData.filter(item => item.type === 'note');
  const lastItem = layoutData[layoutData.length - 1];
  let addButtonX = lastItem ? lastItem.x + 60 : CONFIG.startX; let addButtonY = lastItem ? lastItem.y : CONFIG.startY;
  if (addButtonX > CONFIG.canvasWidth - 80) { addButtonX = CONFIG.startX; addButtonY += CONFIG.lineHeight; }
  const totalHeight = Math.max(600, addButtonY + 200);

  const renderBeams = () => {
    const beams = [];
    const createBeamGroups = (threshold, yOffset) => {
      let groupStart = null;
      renderedNotes.forEach((note, index) => {
        const isEligible = !note.isRest && note.duration <= threshold;
        const prevNote = renderedNotes[index - 1];
        const isLineBreak = prevNote && note.y !== prevNote.y;
        const isForcedBreak = note.beamBreak; 
        if (isEligible && !isLineBreak && !isForcedBreak) { if (groupStart === null) groupStart = index; } 
        else { 
           if (groupStart !== null) {
              const startNote = renderedNotes[groupStart]; const endNote = renderedNotes[index - 1];
              beams.push(<line key={`beam-${threshold}-${groupStart}`} x1={startNote.x - 12} y1={startNote.y - yOffset} x2={endNote.x + 12} y2={endNote.y - yOffset} stroke="black" strokeWidth="4" />);
              groupStart = null;
           }
           if (isEligible) groupStart = index;
        }
      });
      if (groupStart !== null) {
          const startNote = renderedNotes[groupStart]; const endNote = renderedNotes[renderedNotes.length - 1];
          beams.push(<line key={`beam-${threshold}-${groupStart}-end`} x1={startNote.x - 12} y1={startNote.y - yOffset} x2={endNote.x + 12} y2={endNote.y - yOffset} stroke="black" strokeWidth="4" />);
      }
    };
    createBeamGroups(0.5, 28); createBeamGroups(0.25, 36);
    return beams;
  };

  const renderSlurs = () => {
    return renderedNotes.map((currentNote, idx) => {
      if (currentNote.slur && idx < renderedNotes.length - 1) {
        const nextNote = renderedNotes[idx + 1];
        if (currentNote.y === nextNote.y) {
          const startX = currentNote.x;
          const startY = currentNote.y - 55; 
          const endX = nextNote.x;
          const endY = nextNote.y - 55;
          const pathData = `M ${startX} ${startY} Q ${(startX + endX) / 2} ${startY - 30} ${endX} ${endY}`;
          return <path key={`slur-${idx}`} d={pathData} stroke="black" strokeWidth="1.5" fill="none" />;
        }
      }
      return null;
    });
  };

  const updateNote = (idx, changes) => { if (idx===null) return; const n = [...tracks]; const an = [...n[activeTrackIndex].notes]; an[idx] = { ...an[idx], ...changes }; n[activeTrackIndex].notes = an; updateTracksWithHistory(n); };
  const handleAddNote = () => { const n = [...tracks]; const an = [...n[activeTrackIndex].notes]; an.push({ pitch: 1, octave: 0, duration: 1, beamBreak: false, isRest: false, lyric: "", slur: false }); n[activeTrackIndex].notes = an; updateTracksWithHistory(n); setSelectedIndex(an.length-1); setTimeout(()=>lyricInputRef.current?.focus(),50); };
  const toggleSlur = () => selectedIndex!==null && updateNote(selectedIndex, { slur: !currentNotes[selectedIndex].slur });
  const toggleStaccato = () => selectedIndex!==null && updateNote(selectedIndex, { staccato: !currentNotes[selectedIndex].staccato });
  const toggleBeamBreak = () => selectedIndex!==null && updateNote(selectedIndex, { beamBreak: !currentNotes[selectedIndex].beamBreak });
  const toggleAccidental = (type) => selectedIndex!==null && updateNote(selectedIndex, { accidental: currentNotes[selectedIndex].accidental===type ? null : type });
  const changeOctave = (dir) => selectedIndex!==null && updateNote(selectedIndex, { octave: currentNotes[selectedIndex].octave + dir });
  const changeDuration = (dur) => selectedIndex!==null && updateNote(selectedIndex, { duration: dur });
  const handleLyricChange = (e) => { const n = [...tracks]; n[activeTrackIndex].notes[selectedIndex].lyric = e.target.value; setTracks(n); }; // Lirik no-history for speed
  const saveLyricHistory = () => updateTracksWithHistory(tracks);

  const playMusic = async () => {
    Tone.Transport.cancel(); await Tone.start(); Tone.Transport.bpm.value = meta.tempo; const keyShift = KEY_SIGNATURES[meta.key] || 0;
    tracks.forEach((track, tIdx) => {
      const inst = INSTRUMENTS[track.instrument] || INSTRUMENTS['Piano']; const synth = new Tone.PolySynth(inst.type, inst.options).toDestination();
      let time = Tone.Transport.now() + 0.1;
      track.notes.forEach((note, nIdx) => {
        if (!note.isRest) {
          const notes = ['C','D','E','F','G','A','B']; const name = notes[Math.max(0, note.pitch-1)];
          let freq = Tone.Frequency(name + (4 + note.octave + (inst.octaveOffset||0))).transpose(keyShift);
          if(note.accidental==='sharp') freq.transpose(1); if(note.accidental==='flat') freq.transpose(-1);
          synth.triggerAttackRelease(freq, (note.staccato ? 0.5 : 1) * Tone.Time("4n").toSeconds() * note.duration, time);
        }
        if (tIdx === activeTrackIndex) Tone.Draw.schedule(() => setPlayingIndex(nIdx), time);
        time += Tone.Time("4n").toSeconds() * note.duration;
      });
    });
    Tone.Transport.start();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (selectedIndex === null) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey||e.metaKey) && key==='z') { e.preventDefault(); handleUndo(); return; }
      if ((e.ctrlKey||e.metaKey) && key==='y') { e.preventDefault(); handleRedo(); return; }
      if (['1','2','3','4','5','6','7'].includes(key)) updateNote(selectedIndex, { pitch: parseInt(key), isRest: false });
      if (key==='0') updateNote(selectedIndex, { isRest: true });
      if (e.key==='ArrowUp') updateNote(selectedIndex, { octave: currentNotes[selectedIndex].octave+1 });
      if (e.key==='ArrowDown') updateNote(selectedIndex, { octave: currentNotes[selectedIndex].octave-1 });
      if (key==='q') updateNote(selectedIndex, { duration: 1 }); if (key==='w') updateNote(selectedIndex, { duration: 0.5 }); if (key==='e') updateNote(selectedIndex, { duration: 0.25 });
      if (key==='l') toggleSlur(); if (key==='s') toggleStaccato(); if (key==='b') toggleBeamBreak();
      if (e.key==='ArrowRight') setSelectedIndex(p => Math.min(p+1, currentNotes.length-1));
      if (e.key==='ArrowLeft') setSelectedIndex(p => Math.max(p-1, 0));
      if (e.key==='Enter') handleAddNote();
      if (e.key==='Backspace' && currentNotes.length>1) { const n=[...tracks]; n[activeTrackIndex].notes.splice(selectedIndex,1); updateTracksWithHistory(n); setSelectedIndex(p=>Math.max(0,p-1)); }
      if (e.key===' ') { e.preventDefault(); playMusic(); }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, activeTrackIndex, selectedIndex, meta, history, future]);

  const saveProject = () => { const dl = document.createElement('a'); dl.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ meta, tracks })); dl.download = meta.title + ".json"; dl.click(); };
  const triggerLoad = () => fileInputRef.current.click();
  const handleFileChange = (e) => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=(ev)=>{ try{const d=JSON.parse(ev.target.result); if(d.tracks) setTracks(d.tracks); setMeta(d.meta||{title:"Unt", composer:"", tempo:100, key:"C", timeSig:"4/4"}); setActiveTrackIndex(0); setSelectedIndex(0);}catch(e){alert("Err");} }; r.readAsText(f); e.target.value=null; };
  const handleExportImage = async () => { if(paperRef.current) { setSelectedIndex(null); const c = await html2canvas(paperRef.current, { scale: 2, backgroundColor: "#ffffff", ignoreElements: (el) => el.classList.contains('no-print') }); const l = document.createElement("a"); l.href = c.toDataURL("image/png"); l.download = "partitur.png"; l.click(); } };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial", backgroundColor: "#f4f4f9", minHeight: "100vh", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: "sticky", top: "10px", zIndex: 100, background: "white", padding: "10px 20px", borderRadius: "10px", boxShadow: "0 5px 20px rgba(0,0,0,0.1)", width: "100%", maxWidth: CONFIG.canvasWidth, display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={playMusic} style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#4CAF50", color: "white", border: "none", fontSize: "16px", cursor: "pointer" }}>▶</button>
            <input ref={lyricInputRef} type="text" value={currentNotes[selectedIndex]?.lyric || ""} onChange={handleLyricChange} onBlur={saveLyricHistory} placeholder="Lirik..." style={{ border: "1px solid #ccc", borderRadius: "5px", padding: "8px", width: "150px" }}/>
          </div>
          <div style={{ display: "flex", gap: "5px", borderRight:"1px solid #ddd", paddingRight:"10px" }}>
             <button onClick={handleUndo} disabled={history.length===0} style={{ opacity: history.length===0?0.3:1 }}>↩</button>
             <button onClick={handleRedo} disabled={future.length===0} style={{ opacity: future.length===0?0.3:1 }}>↪</button>
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display:'none'}} accept=".json" />
             <button onClick={triggerLoad} style={{ background: "#f0f0f0", border: "1px solid #ccc", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}>📂</button>
             <button onClick={saveProject} style={{ background: "#607D8B", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", cursor: "pointer" }}>💾</button>
             <button onClick={handleExportImage} style={{ background: "#FF9800", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", cursor: "pointer" }}>📷</button>
             {/* TOMBOL MIDI BARU */}
             <button onClick={handleExportMIDI} style={{ background: "#3F51B5", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>🎹 MIDI</button>
          </div>
        </div>
        <hr style={{width: "100%", border: "0", borderTop: "1px solid #eee", margin: "0"}}/>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", overflowX: "auto", paddingBottom: "5px" }}>
            {tracks.map((track, idx) => ( <div key={track.id}><button onClick={() => { setActiveTrackIndex(idx); setSelectedIndex(0); }} style={{ padding: "8px 15px", borderRadius: "5px 5px 0 0", border: "none", cursor: "pointer", fontWeight: "bold", background: activeTrackIndex === idx ? "#2196F3" : "#e0e0e0", color: activeTrackIndex === idx ? "white" : "#666", borderBottom: activeTrackIndex === idx ? "3px solid #0D47A1" : "none" }}>{track.name}</button></div> ))}
            <button onClick={addNewTrack} style={{ padding: "5px 10px", borderRadius: "5px", border: "1px dashed #999", background: "transparent", cursor: "pointer", color: "#666" }}>+ Suara</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", background: "#E3F2FD", padding: "10px", borderRadius: "5px", flexWrap: "wrap", gap: "10px" }}>
           <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
              <select value={tracks[activeTrackIndex].instrument||'Piano'} onChange={(e)=>changeInstrument(e.target.value)} style={{border:"1px solid #1976D2", borderRadius:"4px", padding:"5px"}}>{Object.keys(INSTRUMENTS).map(k=><option key={k} value={k}>{k}</option>)}</select>
              <input type="text" value={tracks[activeTrackIndex].name} onChange={(e) => renameTrack(e.target.value)} style={{ border: "1px solid #90CAF9", padding: "5px", borderRadius: "4px", width: "100px" }}/>
              <button onClick={() => deleteTrack(activeTrackIndex)} style={{ background: "#FFCDD2", color: "#C62828", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Hapus</button>
           </div>
           <div style={{ display: "flex", gap: "5px" }}>
                <button onClick={() => changeOctave(1)} style={{ padding: "2px 8px" }}>⬆</button>
                <button onClick={() => changeOctave(-1)} style={{ padding: "2px 8px" }}>⬇</button>
                <div style={{width: "1px", background:"#bbb", margin: "0 5px"}}></div>
                <button onClick={() => changeDuration(1)} style={{ padding: "2px 8px" }}>1</button>
                <button onClick={() => changeDuration(0.5)} style={{ padding: "2px 8px" }}>1/2</button>
                <button onClick={() => changeDuration(0.25)} style={{ padding: "2px 8px" }}>1/4</button>
                <button onClick={toggleBeamBreak} style={{ padding: "2px 8px", cursor: "pointer", background: currentNotes[selectedIndex]?.beamBreak ? "#FFAB91" : "#f0f0f0", fontWeight: "bold" }} title="Putus Bendera">||</button>
                <div style={{width: "1px", background:"#bbb", margin: "0 5px"}}></div>
                <button onClick={toggleSlur} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.slur ? "#BBDEFB" : "#f0f0f0" }}>⌒</button>
                <button onClick={toggleStaccato} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.staccato ? "#E1BEE7" : "#f0f0f0" }}>.</button>
                <div style={{width: "1px", background:"#bbb", margin: "0 5px"}}></div>
                <button onClick={() => toggleAccidental('sharp')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'sharp' ? "#FFF59D" : "#f0f0f0" }}>/</button>
                <button onClick={() => toggleAccidental('flat')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'flat' ? "#FFF59D" : "#f0f0f0" }}>\</button>
                <button onClick={handleAddNote} style={{ background: "#1976D2", color: "white", padding: "2px 10px", border: "none", borderRadius: "3px", cursor: "pointer" }}>+ Not</button>
           </div>
        </div>
      </div>
      <div ref={paperRef} style={{ marginTop: "20px", background: "white", width: CONFIG.canvasWidth + "px", minHeight: "500px", padding: "40px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", borderRadius: "8px" }}>
        <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
          <input type="text" value={meta.title} onChange={(e)=>setMeta({...meta, title:e.target.value})} style={{fontSize: "28px", fontWeight:"bold", textAlign:"center", border:"none", width:"100%", outline:"none"}} />
          <input type="text" value={meta.composer} onChange={(e)=>setMeta({...meta, composer:e.target.value})} style={{fontSize: "14px", textAlign:"center", border:"none", width:"100%", outline:"none", color:"#666", marginBottom: "15px"}} />
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", alignItems: "center" }} className="no-print"> 
            <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f9f9f9", padding: "5px 10px", borderRadius: "5px" }}>
              <span style={{ color: "#555", fontWeight: "bold" }}>Do =</span><select value={meta.key} onChange={(e) => setMeta({...meta, key: e.target.value})} style={{ border: "none", background: "transparent", fontSize: "16px", fontWeight: "bold", cursor: "pointer", outline: "none" }}>{Object.keys(KEY_SIGNATURES).map(k => <option key={k} value={k}>{k}</option>)}</select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f9f9f9", padding: "5px 10px", borderRadius: "5px" }}><select value={meta.timeSig} onChange={(e) => setMeta({...meta, timeSig: e.target.value})} style={{ border: "none", background: "transparent", fontSize: "16px", fontWeight: "bold", cursor: "pointer", outline: "none" }}><option value="4/4">4/4</option><option value="3/4">3/4</option><option value="2/4">2/4</option><option value="6/8">6/8</option></select></div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", color: "#666" }}><span>Tempo: {meta.tempo}</span><input type="range" min="60" max="200" value={meta.tempo} onChange={(e) => setMeta({...meta, tempo: e.target.value})} style={{width: "60px"}} /></div>
          </div>
        </div>
        <div style={{ marginBottom: "20px", color: "#555", fontStyle: "italic", fontWeight: "bold" }}>Partitur: {tracks[activeTrackIndex].name} ({tracks[activeTrackIndex].instrument})</div>
        <svg width="100%" height={totalHeight}>
          {layoutData.map((item, index) => { if (item.type === 'barline') return <line key={`bar-${index}`} x1={item.x} y1={item.y - 40} x2={item.x} y2={item.y + 40} stroke="#ccc" strokeWidth="2" />; return null; })}
          {renderBeams()}
          {renderedNotes.map((item) => ( <CipherNote key={`note-${item.originalIndex}`} note={item} x={item.x} y={item.y} isSelected={item.originalIndex === selectedIndex} isPlaying={item.originalIndex === playingIndex} onClick={() => { setSelectedIndex(item.originalIndex); lyricInputRef.current.focus(); }} /> ))}
          {renderSlurs()}
          <g className="no-print" onClick={handleAddNote} style={{ cursor: "pointer", opacity: 0.6 }} onMouseEnter={(e)=>e.currentTarget.style.opacity=1} onMouseLeave={(e)=>e.currentTarget.style.opacity=0.6}>
            <circle cx={addButtonX} cy={addButtonY - 5} r="18" fill="#2196F3" />
            <text x={addButtonX} y={addButtonY} fill="white" fontSize="24" fontWeight="bold" textAnchor="middle" dy="8">+</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

export default App;