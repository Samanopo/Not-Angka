/**
 * Website Project
 * Developed by: Samuel
 * Internship contribution – 2025-2026
 */

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import html2canvas from 'html2canvas';
import { Midi } from '@tonejs/midi';

// --- KONFIGURASI VISUAL ---
const CONFIG = {
  beatSpacing: 45,     
  voiceSpacing: 100,   
  systemSpacing: 180,  
  startX: 100,          
  startY: 80,
  minHeight: 1000      
};

const TIME_CONFIG = {
  "4/4": { limit: 4, groupSize: 4 }, 
  "3/4": { limit: 3, groupSize: 6 }, 
  "2/4": { limit: 2, groupSize: 4 }, 
  "6/8": { limit: 3, groupSize: 3 }, 
  "2/2": { limit: 4, groupSize: 4 },
  "3/8": { limit: 3, groupSize: 3 } 
};

const KEY_SIGNATURES = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
const GM_INSTRUMENTS = { 'Piano': 0, 'Organ': 19, 'Violin': 40, 'Flute': 73, 'Bass': 32, 'Synth': 80 };

const getTransposedNote = (note, semitones) => {
  if (semitones === 0) return note; 
  if (typeof note.pitch !== 'number' || note.isRest) return note;
  
  let newNote = { ...note };
  const SHARP_ORDER = [4, 1, 5, 2, 6, 3, 7];
  const FLAT_ORDER = [7, 3, 6, 2, 5, 1, 4];
  newNote.accidental = null; 

  if (semitones > 0) {
    const notesToSharp = SHARP_ORDER.slice(0, semitones);
    if (notesToSharp.includes(newNote.pitch)) newNote.accidental = 'sharp';
  } else if (semitones < 0) {
    const notesToFlat = FLAT_ORDER.slice(0, Math.abs(semitones));
    if (notesToFlat.includes(newNote.pitch)) newNote.accidental = 'flat';
  }
  return newNote;
};

const INSTRUMENTS = {
  'Piano': { type: Tone.Synth, options: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }, octaveOffset: 0 },
  'Organ': { type: Tone.Synth, options: { oscillator: { type: 'triangle' }, envelope: { attack: 0.05, decay: 0.1, sustain: 1, release: 1.2 }, volume: -8 }, octaveOffset: 0 },
  'Violin': { type: Tone.FMSynth, options: { harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.2, decay: 0.3, sustain: 0.8, release: 1 } }, octaveOffset: 0 },
  'Flute': { type: Tone.MonoSynth, options: { oscillator: { type: "sine" }, envelope: { attack: 0.1, decay: 0.4, sustain: 0.8, release: 0.8 }, filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 0.8, baseFrequency: 200, octaves: 4 } }, octaveOffset: 1 },
  'Bass': { type: Tone.MembraneSynth, options: { octaves: 5, pitchDecay: 0.1 }, octaveOffset: -2 },
  'Synth': { type: Tone.DuoSynth, options: { vibratoAmount: 0.5, vibratoRate: 5, harmonicity: 1.5 }, octaveOffset: 0 }
};

const CipherNote = ({ note, x, y, isSelected, isPlaying, onClick, isActiveTrack, isOverflow }) => {
  const fontSize = 24;
  const staccatoY = y - 40; 
  let numberColor = isOverflow ? "#FF0000" : (isActiveTrack ? "black" : "#aaa"); 
  let boxFill = "transparent";
  let boxStroke = "transparent";

  if (isSelected && isActiveTrack) {
      numberColor = "#2E7D32"; boxFill = "rgba(76, 175, 80, 0.1)"; boxStroke = "#4CAF50";
  }
  if (isPlaying) numberColor = "#D50000"; 

  const isNumber = typeof note.pitch === 'number';
  const octaveDots = isNumber ? Array.from({ length: Math.min(3, Math.abs(note.octave)) }) : [];

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect x={x - 12} y={y - 50} width="24" height="90" fill={boxFill} stroke={boxStroke} strokeWidth="1" rx="4"/>
      {isOverflow && <rect x={x - 12} y={y - 50} width="24" height="90" fill="rgba(255, 0, 0, 0.1)" stroke="red" strokeWidth="1" rx="4" style={{pointerEvents:'none'}}/>}
      <text x={x} y={y} fontSize={fontSize} fontFamily="monospace" textAnchor="middle" fontWeight={isActiveTrack ? "bold" : "normal"} fill={numberColor}>{note.isRest ? "0" : note.pitch}</text>
      
      {/* SIMBOL KRES, MOL, DAN NATURAL */}
      {!note.isRest && isNumber && note.accidental === 'sharp' && (<line x1={x - 8} y1={y + 6} x2={x + 8} y2={y - 14} stroke={numberColor} strokeWidth="2" opacity="0.8" />)}
      {!note.isRest && isNumber && note.accidental === 'flat' && (<line x1={x - 8} y1={y - 14} x2={x + 8} y2={y + 6} stroke={numberColor} strokeWidth="2" opacity="0.8" />)}
      {!note.isRest && isNumber && note.accidental === 'natural' && (<text x={x - 14} y={y - 5} fontSize="20" fontFamily="Arial" fill={numberColor}>♮</text>)}
      
      {!note.isRest && isNumber && note.octave > 0 && octaveDots.map((_, i) => (<circle key={`dot-up-${i}`} cx={x} cy={y - 20 - (i * 6)} r="1.8" fill={numberColor} />))}
      {!note.isRest && isNumber && note.octave < 0 && octaveDots.map((_, i) => (<circle key={`dot-down-${i}`} cx={x} cy={y + 10 + (i * 6)} r="1.8" fill={numberColor} />))}
      {note.staccato && !note.isRest && isNumber && (<line x1={x - 3} y1={staccatoY} x2={x + 3} y2={staccatoY} stroke={numberColor} strokeWidth="2.5" strokeLinecap="round" />)}
      {note.beamBreak && isSelected && isActiveTrack && (<line x1={x - 10} y1={y-30} x2={x-10} y2={y-15} stroke="red" strokeWidth="1" strokeDasharray="2,2" />)}
      
      {/* --- NADA EKSTRA (DI BAWAH / HARMONI) --- */}
      {note.graceNote && (
          <text 
            x={x} 
            y={y + 45} 
            fontSize="24" 
            fontFamily="monospace" 
            textAnchor="middle" 
            fill={numberColor} 
            fontWeight="bold"
          >
              {note.graceNote}
          </text>
      )}
    </g>
  );
};

export default function App() {
  const [tracks, setTracks] = useState([
    { id: 1, name: "Sopran", instrument: "Piano", transpose: 0, notes: [{ pitch: 1, octave: 0, duration: 1, isRest: false, slurLength: 0 }] },
    { id: 2, name: "Alto", instrument: "Piano", transpose: 0, notes: [{ pitch: 3, octave: 0, duration: 1, isRest: false, slurLength: 0 }] },
    { id: 3, name: "Tenor", instrument: "Piano", transpose: 0, notes: [{ pitch: 5, octave: 0, duration: 1, isRest: false, slurLength: 0 }] },
    { id: 4, name: "Bass", instrument: "Bass", transpose: 0, notes: [{ pitch: 1, octave: -1, duration: 1, isRest: false, slurLength: 0 }] }
  ]);
  
  const [history, setHistory] = useState([]); 
  const [future, setFuture] = useState([]);   
  const [activeTrackIndex, setActiveTrackIndex] = useState(0); 
  
  const [meta, setMeta] = useState({ title: "Lagu Rohani", subtitle: "", lyricist: "NN", composer: "NN", tempo: 100, notationSystem: "Movable Do", key: "C", timeSig: "4/4" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [playerState, setPlayerState] = useState('stopped'); 
  
  const synthsRef = useRef([]); 
  const lyricInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const paperRef = useRef(null);
  const currentNotes = tracks[activeTrackIndex]?.notes || [];

  const displayTracks = tracks.map(track => ({
    ...track,
    notes: track.notes.map(n => getTransposedNote(n, track.transpose || 0))
  }));

  const timeSigData = TIME_CONFIG[meta.timeSig] || TIME_CONFIG["4/4"];
  const beatsPerBar = timeSigData.limit;
  const barsPerSystem = (meta.timeSig === "3/8") ? 8 : 4;
  const beatsPerSystem = beatsPerBar * barsPerSystem;
  const musicBlockWidth = beatsPerSystem * CONFIG.beatSpacing;
  const svgWidth = CONFIG.startX + musicBlockWidth + 80; 

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.display = "block";
    
    const styleId = "pdf-print-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          @media print {
            body { background: white !important; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            #kertas-partitur { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
            @page { size: A4 portrait; margin: 1cm; }
          }
        `;
        document.head.appendChild(style);
    }
    return () => {
        const styleElement = document.getElementById("pdf-print-styles");
        if (styleElement) styleElement.remove();
    };
  }, []);

  const updateTracksWithHistory = (newTracks) => { setHistory(p => [...p, JSON.parse(JSON.stringify(tracks))]); setFuture([]); setTracks(newTracks); };
  const handleUndo = () => { if (history.length===0) return; const prev=history[history.length-1]; setFuture(f=>[JSON.parse(JSON.stringify(tracks)), ...f]); setTracks(prev); setHistory(h=>h.slice(0,-1)); };
  const handleRedo = () => { if (future.length===0) return; const next=future[0]; setHistory(h=>[...h, JSON.parse(JSON.stringify(tracks))]); setTracks(next); setFuture(f=>f.slice(1)); };

  const updateNote = (idx, changes) => { 
    if (idx===null || !tracks[activeTrackIndex]?.notes[idx]) return; 
    const n = [...tracks]; 
    n[activeTrackIndex].notes[idx] = { ...n[activeTrackIndex].notes[idx], ...changes }; 
    updateTracksWithHistory(n); 
  };

  const handleAddNote = () => { 
    if (!tracks[activeTrackIndex]) return;
    const n = [...tracks]; 
    n[activeTrackIndex].notes.push({ pitch: 1, octave: 0, duration: 1, isRest: false, lyric: "", slurLength: 0, staccato: false }); 
    updateTracksWithHistory(n); 
    setSelectedIndex(n[activeTrackIndex].notes.length-1); 
  };
  
  const addNewTrack = () => { const n = [...tracks]; n.push({ id: Date.now(), name: `Suara ${tracks.length + 1}`, instrument: "Piano", transpose: 0, notes: [{ pitch: 1, octave: 0, duration: 1, isRest: false, slurLength: 0 }] }); updateTracksWithHistory(n); setActiveTrackIndex(n.length-1); setSelectedIndex(0); };
  const deleteTrack = (idx) => { if(tracks.length<=1)return; if(window.confirm("Hapus?")){ updateTracksWithHistory(tracks.filter((_,i)=>i!==idx)); setActiveTrackIndex(0); }};
  const renameTrack = (val) => { const n=[...tracks]; n[activeTrackIndex].name=val; setTracks(n); };
  const changeInstrument = (val) => { const n=[...tracks]; n[activeTrackIndex].instrument=val; setTracks(n); };

  const handleTrackTranspose = (val) => {
    const n = [...tracks];
    n[activeTrackIndex].transpose = parseInt(val);
    updateTracksWithHistory(n);
  };

  const changeDuration = (dur) => selectedIndex !== null && updateNote(selectedIndex, { duration: dur });
  
  const changeOctave = (dir) => {
      if (selectedIndex === null) return;
      const currentOctave = currentNotes[selectedIndex]?.octave || 0;
      const newOctave = currentOctave + dir;
      if (newOctave >= -3 && newOctave <= 3) updateNote(selectedIndex, { octave: newOctave });
  };

  const toggleBeamBreak = () => selectedIndex !== null && updateNote(selectedIndex, { beamBreak: !currentNotes[selectedIndex]?.beamBreak });
  const toggleStaccato = () => selectedIndex !== null && updateNote(selectedIndex, { staccato: !currentNotes[selectedIndex]?.staccato });
  
  const toggleAccidental = (type) => { 
      if(selectedIndex !== null) { 
          const newVal = currentNotes[selectedIndex]?.accidental === type ? null : type; 
          updateNote(selectedIndex, { accidental: newVal }); 
      }
  };
  
  const toggleSlur = () => { if (selectedIndex !== null) { const current = currentNotes[selectedIndex]?.slurLength || 0; let nextLen = current + 1; if (nextLen > 3) nextLen = 0; updateNote(selectedIndex, { slurLength: nextLen }); }};

  const handlePlay = async () => {
    if (Tone.context.state !== 'running') await Tone.context.resume();
    await Tone.start();

    if (Tone.Transport.state === 'paused') { Tone.Transport.start(); setPlayerState('playing'); return; }
    if (Tone.Transport.state === 'started') { Tone.Transport.stop(); }

    synthsRef.current.forEach(synth => synth.dispose());
    synthsRef.current = [];
    Tone.Transport.cancel(); Tone.Transport.stop(); 
    
    Tone.Transport.bpm.value = meta.tempo; 
    
    // --- LOGIKA AUDIO: MOVABLE DO vs FIXED DO ---
    // Jika Fixed Do (Naturel): Paksa main di C (0), mengabaikan Do=...
    // Jika Movable Do: Geser tangga nada sesuai pilihan Do=...
    const keyShift = meta.notationSystem === "Fixed Do" ? 0 : (KEY_SIGNATURES[meta.key] || 0);

    displayTracks.forEach((t, tIdx) => {
      const inst = INSTRUMENTS[t.instrument]||INSTRUMENTS['Piano']; 
      const synth = new Tone.PolySynth(inst.type, inst.options).toDestination();
      synthsRef.current.push(synth);
      
      let accumulatedTime = 0; 
      
      t.notes.forEach((n, nIdx) => {
        if(typeof n.pitch === 'number' && !n.isRest){
          let totalDuration = n.duration;
          for(let i = nIdx + 1; i < t.notes.length; i++) { 
              if (t.notes[i].pitch === ".") { totalDuration += t.notes[i].duration; } 
              else { break; } 
          }
          
          const notes=['C','D','E','F','G','A','B']; 
          const name=notes[Math.max(0,n.pitch-1)];
          
          if(name) {
            let freq = Tone.Frequency(name+(4+(n.octave || 0)+(inst.octaveOffset||0))).transpose(keyShift);
            
            if(n.accidental === 'sharp') freq = freq.transpose(1); 
            if(n.accidental === 'flat') freq = freq.transpose(-1); 
            // Jika 'natural', tidak di-transpose (kembali ke nada asli), sesuai teori musik.

            if (n.graceNote) {
                const gracePitch = parseInt(n.graceNote);
                if (!isNaN(gracePitch) && gracePitch >= 1 && gracePitch <= 7) {
                    const graceName = notes[Math.max(0, gracePitch - 1)];
                    if (graceName) {
                        let graceFreq = Tone.Frequency(graceName+(4+(n.octave || 0)+(inst.octaveOffset||0))).transpose(keyShift);
                        Tone.Transport.schedule((time) => {
                            const durSec = (n.staccato ? 0.5 : 1) * Tone.Time("4n").toSeconds() * (n.duration || 1);
                            synth.triggerAttackRelease(graceFreq, durSec, time);
                        }, accumulatedTime);
                    }
                }
            }

            Tone.Transport.schedule((time) => {
                const durSec = (n.staccato ? 0.5 : 1) * Tone.Time("4n").toSeconds() * totalDuration;
                synth.triggerAttackRelease(freq, durSec, time);
                if(tIdx === activeTrackIndex) { Tone.Draw.schedule(() => { setPlayingIndex(nIdx); }, time); }
            }, accumulatedTime);
          }
        }
        accumulatedTime += Tone.Time("4n").toSeconds() * (n.duration || 1);
      });
    });

    Tone.Transport.start();
    setPlayerState('playing');
  };

  const handlePause = () => { if (Tone.Transport.state === 'started') { Tone.Transport.pause(); setPlayerState('paused'); } };
  const handleStop = () => { Tone.Transport.stop(); Tone.Transport.cancel(); setPlayingIndex(null); setPlayerState('stopped'); };

  const handleExportMIDI = () => {
    const midi = new Midi(); midi.name = meta.title; midi.header.setTempo(meta.tempo);
    const keyShift = meta.notationSystem === "Fixed Do" ? 0 : (KEY_SIGNATURES[meta.key] || 0);

    displayTracks.forEach(t => {
        const tr = midi.addTrack(); tr.name = t.name; tr.instrument.number = GM_INSTRUMENTS[t.instrument]||0;
        let time=0;
        t.notes.forEach((n, nIdx) => {
            const beatDur = 60/meta.tempo;
            let currentDur = beatDur * (n.duration || 1);
            if(typeof n.pitch === 'number' && !n.isRest){
                let totalBeats = n.duration || 1;
                for(let i = nIdx + 1; i < t.notes.length; i++) { if (t.notes[i].pitch === ".") totalBeats += t.notes[i].duration; else break; }
                const scale=[0,2,4,5,7,9,11]; const base=scale[Math.max(0,n.pitch-1)];
                let mn=60+base+((n.octave||0)*12) + keyShift;
                if(n.accidental==='sharp') mn += 1; if(n.accidental==='flat') mn -= 1;
                tr.addNote({ midi: mn, time: time, duration: beatDur * totalBeats, velocity: 0.8 });
            }
            time+=currentDur;
        });
    });
    const blob = new Blob([midi.toArray()], {type:'audio/midi'}); const l=document.createElement('a'); l.href=URL.createObjectURL(blob); l.download=`${meta.title}.mid`; document.body.appendChild(l); l.click(); l.remove();
  };

  const saveProject = () => { const dl = document.createElement('a'); dl.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ meta, tracks })); dl.download = meta.title + ".json"; dl.click(); };
  
  const triggerLoad = () => fileInputRef.current?.click();
  const handleFileChange = (e) => { 
      const f=e.target.files[0]; 
      if(!f)return; 
      const r=new FileReader(); 
      r.onload=(ev)=>{ 
          try{
              const d=JSON.parse(ev.target.result); 
              if(d.tracks) setTracks(d.tracks); 
              if(d.meta) setMeta({
                  title: d.meta.title || "Lagu Rohani",
                  subtitle: d.meta.subtitle || "",
                  lyricist: d.meta.lyricist || "NN",
                  composer: d.meta.composer || "NN",
                  tempo: d.meta.tempo || 100, 
                  notationSystem: d.meta.notationSystem || "Movable Do", 
                  key: d.meta.key || "C",
                  timeSig: d.meta.timeSig || "4/4"
              }); 
          } catch(err) {
              alert("Gagal membaca file JSON");
          } 
      }; 
      r.readAsText(f); e.target.value=null; 
  };
  
  const handleExportImage = async () => { 
      if(paperRef.current) { 
          setSelectedIndex(null); 
          const c = await html2canvas(paperRef.current, { scale: 2, backgroundColor: "#ffffff" }); 
          const l = document.createElement("a"); 
          l.href = c.toDataURL("image/png"); 
          l.download = "partitur.png"; 
          l.click(); 
      } 
  };

  const calculateScoreLayout = () => {
    if (!displayTracks || displayTracks.length === 0) return { elements: [], totalHeight: CONFIG.minHeight };

    const systemHeight = (tracks.length - 1) * CONFIG.voiceSpacing;
    let layoutElements = [];

    let maxBeat = 0;
    const trackNotesWithTime = displayTracks.map(track => {
        let currentBeat = 0;
        const mappedNotes = (track.notes || []).map((note, index) => {
            const startBeat = currentBeat;
            currentBeat += note?.duration || 1; 
            return { ...note, startBeat, originalIndex: index };
        });
        if (currentBeat > maxBeat) maxBeat = currentBeat;
        return mappedNotes;
    });

    const totalSystems = Math.max(1, Math.ceil(maxBeat / beatsPerSystem));
    let currentY = CONFIG.startY;

    for (let systemIdx = 0; systemIdx < totalSystems; systemIdx++) {
        const systemStartBeat = systemIdx * beatsPerSystem;
        const systemEndBeat = systemStartBeat + beatsPerSystem;
        let currentX = CONFIG.startX;

        displayTracks.forEach((t, i) => { 
            layoutElements.push({ type: 'label', text: t.name || "", x: currentX - 40, y: currentY + (i * CONFIG.voiceSpacing) }); 
        });

        // PERBAIKAN: Menggunakan x1 dan x2 agar garis lurus
        layoutElements.push({ type: 'barline', x: currentX - 25, y1: currentY - 30, y2: currentY + systemHeight + 65 });

        for (let bar = 1; bar <= barsPerSystem; bar++) {
            const barX = currentX + (bar * beatsPerBar * CONFIG.beatSpacing) - (CONFIG.beatSpacing / 2);
            layoutElements.push({ type: 'barline', x: barX, y1: currentY - 30, y2: currentY + systemHeight + 65 });
        }

        let columnLyrics = {}; 

        trackNotesWithTime.forEach((notes, trackIdx) => {
            (notes || []).forEach(note => {
                if (note && note.startBeat >= systemStartBeat && note.startBeat < systemEndBeat) {
                    const beatWithinSystem = note.startBeat - systemStartBeat;
                    const noteX = currentX + (beatWithinSystem * CONFIG.beatSpacing);
                    const noteY = currentY + (trackIdx * CONFIG.voiceSpacing);

                    const beatInBar = note.startBeat % beatsPerBar;
                    const isOverflow = (beatInBar + (note.duration || 1)) > (beatsPerBar + 0.01);

                    layoutElements.push({ 
                        ...note, 
                        type: 'note', 
                        x: noteX, 
                        y: noteY, 
                        originalIndex: note.originalIndex, 
                        trackIndex: trackIdx,
                        isOverflow: isOverflow 
                    });

                    if (note.lyric && !columnLyrics[noteX]) {
                        columnLyrics[noteX] = note.lyric;
                    }
                }
            });
        });

        Object.keys(columnLyrics).forEach(xPos => {
            layoutElements.push({ 
                type: 'lyric', 
                text: columnLyrics[xPos], 
                x: parseFloat(xPos), 
                y: currentY + systemHeight + 50 
            });
        });

        currentY += systemHeight + CONFIG.systemSpacing;
    }

    return { elements: layoutElements, totalHeight: Math.max(CONFIG.minHeight, currentY + 100) };
  };

  const { elements, totalHeight } = calculateScoreLayout();
  const renderedNotes = elements.filter(e => e.type === 'note');
  const lastNote = renderedNotes.filter(n => n.trackIndex === activeTrackIndex).pop();
  
  let addButtonX = CONFIG.startX + 20; 
  let addButtonY = CONFIG.startY + (activeTrackIndex * CONFIG.voiceSpacing);
  if (lastNote) {
      addButtonX = (lastNote.x || 0) + 40; 
      addButtonY = lastNote.y || 0;
  }
  if (addButtonX > svgWidth - 40) { 
      addButtonX = CONFIG.startX; 
      addButtonY += CONFIG.systemSpacing + (3 * CONFIG.voiceSpacing); 
  }

  const renderBeams = () => {
    const beams = [];
    const groupSize = (TIME_CONFIG[meta.timeSig] || TIME_CONFIG["4/4"]).groupSize;
    displayTracks.forEach((_, tIdx) => {
        const trackNotes = renderedNotes.filter(n => n.trackIndex === tIdx);
        const createBeamGroups = (threshold, yOffset) => {
            let groupStart = null; let countInGroup = 0;
            trackNotes.forEach((note, i) => {
                const isNum = typeof note.pitch === 'number';
                const eligible = !note.isRest && isNum && (note.duration || 1) <= threshold;
                const prev = trackNotes[i-1];
                const isBreak = prev && note.y !== prev.y; 
                const isManualBreak = note.beamBreak; 
                const shouldBreakGroup = isBreak || isManualBreak || countInGroup >= groupSize;
                
                if (shouldBreakGroup) {
                    if (groupStart !== null) {
                        const s = trackNotes[groupStart]; const e = trackNotes[i-1];
                        beams.push(<line key={`b-${tIdx}-${threshold}-${groupStart}`} x1={(s?.x||0)-10} y1={(s?.y||0)-yOffset} x2={(e?.x||0)+10} y2={(e?.y||0)-yOffset} stroke="black" strokeWidth="2" />);
                        groupStart = null; countInGroup = 0;
                    }
                }
                if (eligible) { if (groupStart === null) groupStart = i; countInGroup++; } 
                else {
                    if (groupStart !== null) {
                        const s = trackNotes[groupStart]; const e = trackNotes[i-1];
                        beams.push(<line key={`b-${tIdx}-${threshold}-${groupStart}`} x1={(s?.x||0)-10} y1={(s?.y||0)-yOffset} x2={(e?.x||0)+10} y2={(e?.y||0)-yOffset} stroke="black" strokeWidth="2" />);
                        groupStart = null; countInGroup = 0;
                    }
                }
            });
            if (groupStart !== null) {
                const s = trackNotes[groupStart]; const e = trackNotes[trackNotes.length - 1];
                beams.push(<line key={`b-${tIdx}-${threshold}-${groupStart}-end`} x1={(s?.x||0)-10} y1={(s?.y||0)-yOffset} x2={(e?.x||0)+10} y2={(e?.y||0)-yOffset} stroke="black" strokeWidth="2" />);
            }
        };
        createBeamGroups(0.5, 45); 
        createBeamGroups(0.25, 53); 
    });
    return beams;
  };

  const renderSlurs = () => {
      const slurs = [];
      displayTracks.forEach((_, tIdx) => {
          const trackNotes = renderedNotes.filter(n => n.trackIndex === tIdx);
          trackNotes.forEach((n, i) => {
            const len = n.slurLength || 0;
            if (len > 0) {
              const targetIndex = i + len; 
              if (targetIndex < trackNotes.length) {
                 const target = trackNotes[targetIndex];
                 if (target && n.y === target.y) {
                    const sx = n.x; const sy = n.y - 55; const ex = target.x; const ey = target.y - 55;
                    slurs.push(<path key={`s-${tIdx}-${i}`} d={`M ${sx} ${sy} Q ${(sx+ex)/2} ${sy-25} ${ex} ${ey}`} stroke="black" strokeWidth="1.5" fill="none"/>);
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
      if (e.key===' ') { e.preventDefault(); handlePlay(); } 
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, activeTrackIndex, selectedIndex, meta, playerState]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", backgroundColor: "#f4f4f9", minHeight: "100vh", width: "100vw", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      
      {/* KOTAK MENU ATAS */}
      <div className="no-print" style={{ position: "sticky", top: "10px", zIndex: 100, background: "white", padding: "10px 20px", borderRadius: "10px", boxShadow: "0 5px 20px rgba(0,0,0,0.1)", marginBottom: "20px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handlePlay} style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", fontSize: "18px", cursor: "pointer", background: playerState === 'playing' ? "#388E3C" : "#4CAF50", color: "white", display: "flex", justifyContent: "center", alignItems: "center", paddingLeft: "4px" }}>▶</button>
            <button onClick={handlePause} style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", fontSize: "16px", cursor: "pointer", fontWeight: "bold", background: playerState === 'paused' ? "#FFB300" : "#FFC107", color: "white", display: "flex", justifyContent: "center", alignItems: "center" }}>||</button>
            <button onClick={handleStop} style={{ width: "40px", height: "40px", borderRadius: "50%", border: "none", fontSize: "16px", cursor: "pointer", background: "#f44336", color: "white", display: "flex", justifyContent: "center", alignItems: "center" }}>■</button>
            <input ref={lyricInputRef} type="text" value={currentNotes[selectedIndex]?.lyric || ""} onChange={(e)=>updateNote(selectedIndex, {lyric: e.target.value})} placeholder="Lirik (Track Aktif)..." style={{ border: "1px solid #ccc", borderRadius: "5px", padding: "8px", width: "150px" }}/>
            
            <button 
                onClick={() => {
                    const currentGrace = currentNotes[selectedIndex]?.graceNote || "";
                    const inputVal = prompt("Masukkan angka nada harmonis (1-7):", currentGrace);
                    
                    if (inputVal === null) return; 
                    if (inputVal.trim() === "") { 
                        updateNote(selectedIndex, { graceNote: "" });
                        return;
                    }

                    const num = parseInt(inputVal);
                    if (!isNaN(num) && num >= 1 && num <= 7 && inputVal.length === 1) {
                        updateNote(selectedIndex, { graceNote: inputVal });
                    } else {
                        alert("Hanya boleh memasukkan angka 1 sampai 7!");
                    }
                }} 
                style={{ background: "#9C27B0", color: "white", padding: "8px 10px", border: "none", borderRadius: "5px", cursor: "pointer", marginLeft: "10px", fontWeight: "bold", fontSize: "12px" }}
            >
                + Nada Ekstra
            </button>
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
             <button onClick={handleUndo} style={{ padding: "5px 10px" }}>↩</button>
             <button onClick={handleRedo} style={{ padding: "5px 10px" }}>↪</button>
             <button onClick={saveProject} style={{ background: "#607D8B", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px" }}>💾</button>
             <button onClick={handleExportImage} style={{ background: "#FF9800", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", cursor: "pointer" }}>📷 IMG</button>
             <button onClick={() => window.print()} style={{ background: "#FF5722", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>📄 PDF</button>
             <button onClick={handleExportMIDI} style={{ background: "#3F51B5", color: "white", padding: "5px 10px", border: "none", borderRadius: "5px", fontWeight: "bold" }}>🎹</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "5px", overflowX: "auto", paddingBottom: "10px", borderBottom: "1px solid #eee" }}>
            {(tracks || []).map((track, idx) => ( <button key={track.id} onClick={() => { setActiveTrackIndex(idx); setSelectedIndex(0); }} style={{ padding: "5px 15px", border: "none", cursor: "pointer", background: activeTrackIndex === idx ? "#2196F3" : "#e0e0e0", color: activeTrackIndex === idx ? "white" : "#666", borderRadius: "20px", fontWeight: "bold" }}>{track.name}</button> ))}
            <button onClick={addNewTrack} style={{ padding: "5px 10px", borderRadius: "20px", border: "1px dashed #999", background: "white", cursor: "pointer" }}>+ Suara</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", flexWrap: "wrap", gap: "10px", background: "#E3F2FD", padding: "10px", borderRadius: "5px" }}>
           <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
              <select value={tracks[activeTrackIndex]?.instrument||'Piano'} onChange={(e)=>changeInstrument(e.target.value)} style={{border:"1px solid #1976D2", borderRadius:"4px", padding:"5px"}}>{Object.keys(INSTRUMENTS).map(k=><option key={k} value={k}>{k}</option>)}</select>
              <input type="text" value={tracks[activeTrackIndex]?.name || ""} onChange={(e) => renameTrack(e.target.value)} style={{ border: "1px solid #90CAF9", padding: "5px", borderRadius: "4px", width: "80px" }}/>
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
                
                {/* TOMBOL KRES, MOL, DAN NATURAL */}
                <button onClick={() => toggleAccidental('sharp')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'sharp' ? "#FFF59D" : "#f0f0f0" }}>/</button>
                <button onClick={() => toggleAccidental('flat')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'flat' ? "#FFF59D" : "#f0f0f0" }}>\</button>
                <button onClick={() => toggleAccidental('natural')} style={{ padding: "2px 8px", background: currentNotes[selectedIndex]?.accidental === 'natural' ? "#FFF59D" : "#f0f0f0", fontWeight: "bold" }}>♮</button>
                
                <button onClick={handleAddNote} style={{ background: "#1976D2", color: "white", padding: "2px 10px", border: "none", borderRadius: "3px", cursor: "pointer" }}>+ Not</button>
           </div>
        </div>
      </div>
      
      {/* AREA KERTAS */}
      <div id="kertas-partitur" ref={paperRef} style={{ background: "white", width: `${svgWidth + 80}px`, maxWidth: "100%", margin: "0 auto", overflowX: "auto", minHeight: `${CONFIG.minHeight}px`, padding: "40px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", borderRadius: "8px", boxSizing: "border-box" }}>
        
        <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
          
          <input type="text" value={meta.title || ""} onChange={(e)=>setMeta({...meta, title:e.target.value})} style={{fontSize: "32px", fontWeight:"bold", textAlign:"center", border:"none", width:"100%", outline:"none"}} placeholder="Judul Lagu" />
          
          <input type="text" value={meta.subtitle || ""} onChange={(e)=>setMeta({...meta, subtitle:e.target.value})} style={{fontSize: "18px", textAlign:"center", border:"none", width:"100%", outline:"none", marginTop: "5px", color: "#666"}} placeholder="Sub Judul (Opsional)" />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", padding: "0 30px" }}>
             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{fontSize: "15px", fontWeight: "bold", color: "#444"}}>Syair/Puisi:</span>
                <input type="text" value={meta.lyricist || ""} onChange={(e)=>setMeta({...meta, lyricist:e.target.value})} style={{fontSize: "15px", border:"none", outline:"none", borderBottom: "1px dashed #ccc", width: "180px", background: "transparent"}} placeholder="Nama Penulis" />
             </div>
             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{fontSize: "15px", fontWeight: "bold", color: "#444"}}>Lagu/Arr:</span>
                <input type="text" value={meta.composer || ""} onChange={(e)=>setMeta({...meta, composer:e.target.value})} style={{fontSize: "15px", border:"none", outline:"none", borderBottom: "1px dashed #ccc", width: "180px", textAlign: "right", background: "transparent"}} placeholder="Nama Pencipta" />
             </div>
          </div>

          <div className="no-print" data-html2canvas-ignore="true" style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "25px" }}> 
             <div style={{display: "flex", alignItems: "center", gap: "5px", border: "1px solid #ddd", padding: "2px 5px", borderRadius: "5px"}}>
                <span style={{fontSize: "14px", fontWeight: "bold", color: "#555"}}>Transpose:</span>
                <select value={tracks[activeTrackIndex]?.transpose || 0} onChange={(e) => handleTrackTranspose(e.target.value)} style={{border: "none", outline: "none", background: "transparent", fontWeight: "bold", cursor:"pointer"}}>
                    <option value={0}>Normal (C)</option>
                    {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>+{n}</option>)}
                    {[-1, -2, -3, -4, -5, -6, -7].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
             </div>
             
             {/* --- MENU DO = ... YANG KEMBALI DIMUNCULKAN BERDAMPINGAN --- */}
             <select 
                value={meta.key || "C"} 
                onChange={(e) => setMeta({...meta, key: e.target.value})} 
                style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc", outline: "none", cursor: "pointer", fontWeight: "bold" }}
             >
                {Object.keys(KEY_SIGNATURES).map(k=><option key={k} value={k}>Do = {k}</option>)}
             </select>

             <select 
                value={meta.notationSystem || "Movable Do"} 
                onChange={(e) => setMeta({...meta, notationSystem: e.target.value})}
                style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc", outline: "none", cursor: "pointer", fontWeight: "bold" }}
             >
                <option value="Movable Do">Movable Do (Bergerak)</option>
                <option value="Fixed Do">Fixed Do (Tetap)</option>
             </select>

             <select value={meta.timeSig || "4/4"} onChange={(e) => setMeta({...meta, timeSig: e.target.value})} style={{ padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}>
                {Object.keys(TIME_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display:'none'}} accept=".json" />
        <div className="no-print" data-html2canvas-ignore="true" style={{textAlign:"center", marginBottom: "10px"}}>
            <button onClick={triggerLoad} style={{background: "#f0f0f0", border: "1px solid #ccc", padding: "5px 15px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", color: "#555"}}>📂 Buka File Project (.json)</button>
        </div>
        <svg width={svgWidth} height={totalHeight}>
          {elements.filter(e => e.type === 'barline').map((item, index) => ( <line key={`bar-${index}`} x1={item.x} y1={item.y1} x2={item.x} y2={item.y2} stroke="#ccc" strokeWidth="2" /> ))}
          {elements.filter(e => e.type === 'label').map((item, index) => ( <text key={`lbl-${index}`} x={item.x} y={item.y} fontSize="14" fill="#888" fontWeight="bold" dominantBaseline="middle" textAnchor="end">{item.text}</text> ))}
          
          {elements.filter(e => e.type === 'lyric').map((item, index) => ( 
             <text key={`lyric-${index}`} x={item.x} y={item.y} fontSize="16" fontFamily="Arial" textAnchor="middle" fill="#444" style={{ fontStyle: "normal", fontWeight: "500" }}>{item.text}</text> 
          ))}

          {renderedNotes.map((item, i) => ( 
             <CipherNote 
               key={`note-${item.trackIndex}-${item.originalIndex}`} 
               note={item} 
               x={item.x} 
               y={item.y} 
               isActiveTrack={item.trackIndex === activeTrackIndex} 
               isSelected={item.trackIndex === activeTrackIndex && item.originalIndex === selectedIndex} 
               isPlaying={item.trackIndex === activeTrackIndex && item.originalIndex === playingIndex} 
               isOverflow={item.isOverflow} 
               onClick={() => { setActiveTrackIndex(item.trackIndex); setSelectedIndex(item.originalIndex); lyricInputRef.current?.focus(); }} 
             /> 
          ))}
          {renderBeams()}
          {renderSlurs()}
          <g className="no-print" data-html2canvas-ignore="true" onClick={handleAddNote} style={{ cursor: "pointer", opacity: 0.6 }} onMouseEnter={(e)=>e.currentTarget.style.opacity=1} onMouseLeave={(e)=>e.currentTarget.style.opacity=0.6}>
            <circle cx={addButtonX} cy={addButtonY - 5} r="15" fill="#2196F3" />
            <text x={addButtonX} y={addButtonY} fill="white" fontSize="20" fontWeight="bold" textAnchor="middle" dy="6">+</text>
          </g>
        </svg>
      </div>

      <div className="no-print" style={{ textAlign: "center", marginTop: "auto", padding: "20px", color: "#888", fontSize: "12px", width: "100%" }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>Website Project</p>
        <p style={{ margin: "4px 0" }}>Developed by: Samuel</p>
        <p style={{ margin: 0 }}>Internship contribution – 2025-2026</p>
      </div>
    </div>
  );
}