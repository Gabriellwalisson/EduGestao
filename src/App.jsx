import React, { useState, useEffect, useContext, createContext, useMemo, useRef } from 'react';

// --- INTEGRAÇÃO FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDD8j_-y6vLiQxaQoXFSjoEfBxRFN18FhQ",
    authDomain: "educa-avalia-bf151.firebaseapp.com",
    projectId: "educa-avalia-bf151",
    storageBucket: "educa-avalia-bf151.firebasestorage.app",
    messagingSenderId: "185960297854",
    appId: "1:185960297854:web:69f308e2199ea3aeb26f2f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'educa-avalia-default';
const getCollectionPath = (col) => `artifacts/${currentAppId}/public/data/${col}`;

const dbService = {
    add: async (col, item, explicitId = null) => {
        const id = explicitId || Math.random().toString(36).substr(2, 9);
        const newItem = { ...item, id, createdAt: Date.now() };
        await setDoc(doc(db, getCollectionPath(col), id), newItem);
        return newItem;
    },
    update: async (col, id, updatedFields) => {
        await updateDoc(doc(db, getCollectionPath(col), id), updatedFields);
    },
    delete: async (col, id) => {
        await deleteDoc(doc(db, getCollectionPath(col), id));
    }
};

const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

// --- Regras e utilitários pedagógicos ---
const MEDIA_MINIMA = 60; // % mínimo de aproveitamento (ajuste conforme a regra da escola)
const toNum = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const percentOf = (obtido, possivel) => (possivel > 0 ? (obtido / possivel) * 100 : 0);
const dueTime = (act) => {
    if (!act || !act.dueDate) return Infinity;
    const d = String(act.dueDate);
    const t = new Date(d.length <= 10 ? `${d}T23:59:59` : d).getTime();
    return Number.isNaN(t) ? Infinity : t;
};
const describeDue = (act, now = Date.now()) => {
    const t = dueTime(act);
    if (t === Infinity) return 'sem prazo';
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    const b = new Date(t); b.setHours(0, 0, 0, 0);
    const days = Math.round((b - a) / 86400000);
    if (days < 0) return `venceu há ${-days} ${-days === 1 ? 'dia' : 'dias'}`;
    if (days === 0) return 'vence hoje';
    if (days === 1) return 'vence amanhã';
    return `vence em ${days} dias`;
};
// Situação da atividade para o aluno (modelo "A fazer" dos sistemas tipo Google Classroom)
const getActivityStatus = (act, submission, grade, now = Date.now()) => {
    if (grade) return { key: 'graded', label: grade.grade === 'Visto' ? 'Visto' : 'Corrigida', variant: 'emerald' };
    if (submission) return { key: 'submitted', label: 'Entregue', variant: 'indigo' };
    if (dueTime(act) < now) return { key: 'late', label: 'Atrasada', variant: 'orange' };
    return { key: 'todo', label: 'A fazer', variant: 'amber' };
};
const csvCell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas no Excel
    return `"${s.replace(/"/g, '""')}"`;
};
const downloadCSV = (name, lines) => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const FREQUENCIA_MINIMA = 75; // % mínimo de presença (LDB: 75% da carga horária)
const FALTA_JUSTIFICADA_CONTA_PRESENCA = false; // true = falta justificada não prejudica a frequência
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDateBR = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
const calcFrequency = (marks) => {
    const total = marks.length;
    const p = marks.filter(m => m === 'P').length, f = marks.filter(m => m === 'F').length, j = marks.filter(m => m === 'J').length;
    const pct = total > 0 ? ((p + (FALTA_JUSTIFICADA_CONTA_PRESENCA ? j : 0)) / total) * 100 : null;
    return { total, p, f, j, pct };
};
const ATT_INFO = {
    P: { label: 'Presente', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    F: { label: 'Falta', cls: 'bg-red-50 text-red-700 border-red-200' },
    J: { label: 'Justificada', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};
// Alunos com frequência abaixo do mínimo, por turma
const lowAttendanceList = (classes, enrollments, allStudents, attendance) => {
    const out = [];
    classes.forEach(c => {
        const days = attendance.filter(a => a.classId === c.id && a.records);
        enrollments.filter(e => e.classId === c.id).forEach(e => {
            const st = allStudents.find(s => s.id === e.studentId);
            if (!st) return;
            const fr = calcFrequency(days.map(d => d.records[st.id]).filter(Boolean));
            if (fr.pct !== null && fr.pct < FREQUENCIA_MINIMA) out.push({ st, cls: c, pct: fr.pct });
        });
    });
    return out.sort((a, b) => a.pct - b.pct);
};

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const todayLabel = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const LOGO_SVG_URI = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="30" r="14" fill="#f97316"/><path d="M50 48 Q 30 60 25 80 Q 40 75 50 55 Z" fill="#eab308"/><path d="M50 48 Q 70 60 75 80 Q 60 75 50 55 Z" fill="#16a34a"/><path d="M15 85 Q 50 95 85 85 Q 50 100 15 85 Z" fill="#1e1b4b"/><path d="M15 82 Q 50 92 85 82 Q 50 97 15 82 Z" fill="#312e81"/></svg>')}`;

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 0; background-color: #fefce8; color: #1c1917; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #fde047; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #facc15; }
  @keyframes slideUpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .animate-fade-in { animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .grid-auto-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
  body .bg-\\[\\#fefce8\\] { background-color: #fefce8; background-image: radial-gradient(900px 420px at 100% -8%, rgba(249,115,22,.08), transparent 60%), radial-gradient(800px 420px at -8% 108%, rgba(22,163,74,.08), transparent 60%); background-attachment: fixed; }
  .brand-stripe { height: 4px; background: linear-gradient(90deg, #f97316 0 25%, #eab308 25% 50%, #16a34a 50% 75%, #1e1b4b 75% 100%); }
  .dots-pattern { background-image: radial-gradient(rgba(255,255,255,.13) 1.2px, transparent 1.2px); background-size: 22px 22px; }
  .logo-float { animation: logoFloat 6s ease-in-out infinite; }
  @keyframes logoFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes modalIn { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
  .modal-in { animation: modalIn .22s cubic-bezier(0.16, 1, 0.3, 1) both; }
  table tbody tr { transition: background-color .15s; }
  ::selection { background: rgba(249,115,22,.25); }
  ::-webkit-scrollbar-thumb { background: linear-gradient(#f97316, #eab308); }
  .page-title { display: flex; align-items: center; gap: .75rem; font-size: 1.75rem; line-height: 1.15; font-weight: 900; letter-spacing: -.02em; color: #1e1b4b; padding-bottom: .25rem; }
  .page-title::before { content: ''; flex-shrink: 0; width: 6px; height: 1.9rem; border-radius: 999px; background: linear-gradient(#f97316 0 33%, #eab308 33% 66%, #16a34a 66%); }
  .rounded-xl { border-radius: 1rem !important; }
  .rounded-lg { border-radius: .75rem !important; }
  div.bg-white.rounded-xl.border { box-shadow: 0 1px 2px rgba(30,27,75,.04), 0 10px 28px -14px rgba(30,27,75,.16); }
  select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]) { border-radius: .75rem !important; transition: box-shadow .2s, border-color .2s; }
  select:focus, textarea:focus, input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 4px rgba(249,115,22,.15) !important; outline: none; }
  table thead { background: linear-gradient(90deg, #fff7ed, #fefce8) !important; }
  table tbody tr:hover { background-color: rgba(249,115,22,.05) !important; }
  div.text-center.text-stone-500.font-bold.bg-white { background-image: url("${LOGO_SVG_URI}"); background-repeat: no-repeat; background-position: center 22px; background-size: 52px; padding-top: 92px !important; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body { -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
  .min-h-screen { min-height: 100vh; min-height: 100dvh; }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #f97316; outline-offset: 2px; }
  @media (max-width: 640px) { input, select, textarea { font-size: 16px; } }
  @media print { aside, nav, button { display: none !important; } body { background: #fff; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }
`;

const AppContext = createContext();

const Icon = ({ name, className = "w-5 h-5", onClick }) => {
    const icons = {
        'home': <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>,
        'users': <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>,
        'book': <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></>,
        'file-text': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></>,
        'check-circle': <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></>,
        'clock': <><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></>,
        'plus': <><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></>,
        'trash': <><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></>,
        'edit': <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></>,
        'download': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></>,
        'upload': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></>,
        'log-out': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></>,
        'x': <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>,
        'user': <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></>,
        'lock': <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></>,
        'search': <><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></>,
        'chevron-right': <><polyline points="9 18 15 12 9 6"></polyline></>,
        'menu': <><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></>,
        'tag': <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></>,
        'eye': <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></>,
        'bell': <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></>,
        'calendar': <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></>,
        'message': <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></>,
        'printer': <><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></>
    };
    return (
        <svg onClick={onClick} className={`${className} ${onClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {icons[name] || icons['user']}
        </svg>
    );
};

const LogoEscola = ({ className = "w-8 h-8" }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="30" r="14" fill="#f97316" />
        <path d="M50 48 Q 30 60 25 80 Q 40 75 50 55 Z" fill="#eab308" />
        <path d="M50 48 Q 70 60 75 80 Q 60 75 50 55 Z" fill="#16a34a" />
        <path d="M15 85 Q 50 95 85 85 Q 50 100 15 85 Z" fill="#1e1b4b" />
        <path d="M15 82 Q 50 92 85 82 Q 50 97 15 82 Z" fill="#312e81" />
    </svg>
);

const Button = ({ children, variant = 'primary', icon, onClick, className = '', type = 'button', disabled = false }) => {
    const variants = {
        primary: "bg-gradient-to-br from-[#1e1b4b] to-[#312e81] text-white hover:shadow-lg hover:shadow-[#1e1b4b]/25 hover:-translate-y-px active:translate-y-0 active:scale-[.98] border border-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
        secondary: "bg-white text-stone-800 hover:bg-yellow-50 hover:border-[#f97316]/60 active:scale-[.98] shadow-sm border border-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed",
        danger: "bg-red-50 text-red-700 hover:bg-red-100 active:scale-[.98] border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed",
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 ${variants[variant]} ${className}`}>
            {icon && <Icon name={icon} className="w-4 h-4" />}
            {children}
        </button>
    );
};

const Card = ({ children, title, action, className = '', noPadding = false }) => (
    <div className={`bg-white rounded-2xl border border-yellow-200/80 flex flex-col overflow-hidden shadow-[0_1px_2px_rgba(30,27,75,.04),0_10px_28px_-14px_rgba(30,27,75,.16)] ${className}`}>
        {(title || action) && (
            <div className="px-6 py-4 border-b border-yellow-100 flex items-center justify-between">
                <h3 className="font-black text-[#1e1b4b] text-sm uppercase tracking-wide flex items-center gap-2"><span className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[#f97316] to-[#eab308]"></span>{title}</h3>
                {action && <div>{action}</div>}
            </div>
        )}
        <div className={`flex-1 ${noPadding ? '' : 'p-6'}`}>{children}</div>
    </div>
);

const MET_TONES = {
    orange: { chip: 'bg-[#f97316]/10 text-[#f97316]', bar: 'bg-[#f97316]' },
    yellow: { chip: 'bg-[#eab308]/15 text-[#ca8a04]', bar: 'bg-[#eab308]' },
    green: { chip: 'bg-[#16a34a]/10 text-[#16a34a]', bar: 'bg-[#16a34a]' },
    indigo: { chip: 'bg-[#1e1b4b]/10 text-[#1e1b4b]', bar: 'bg-[#1e1b4b]' },
};
const MET_ICON_TONE = { book: 'orange', clock: 'orange', 'file-text': 'yellow', users: 'green', 'check-circle': 'green', download: 'indigo', calendar: 'indigo' };

const MetricCard = ({ title, value, icon, onClick }) => {
    const tone = MET_TONES[MET_ICON_TONE[icon] || 'orange'];
    return (
        <div onClick={onClick} className={`relative overflow-hidden bg-white rounded-2xl border border-yellow-200/80 p-6 pl-7 flex flex-col gap-3 shadow-[0_1px_2px_rgba(30,27,75,.04),0_10px_28px_-14px_rgba(30,27,75,.16)] transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_30px_-12px_rgba(30,27,75,.28)] active:scale-[.99]' : ''}`}>
            <span className={`absolute left-0 top-0 h-full w-1.5 ${tone.bar}`}></span>
            <div className="absolute -bottom-4 -right-3 text-[#1e1b4b] opacity-[.05] pointer-events-none"><Icon name={icon} className="w-24 h-24" /></div>
            <div className="flex justify-between items-center relative">
                <p className="text-xs font-black uppercase tracking-widest text-stone-500">{title}</p>
                <div className={`p-2.5 rounded-xl ${tone.chip}`}>
                    <Icon name={icon} className="w-5 h-5" />
                </div>
            </div>
            <p className="text-4xl font-black text-[#1e1b4b] tracking-tight relative">{value}</p>
        </div>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1e1b4b]/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl border border-yellow-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] modal-in">
                <div className="brand-stripe shrink-0"></div>
                <div className="px-6 py-5 border-b border-yellow-100 flex justify-between items-center shrink-0 bg-white z-10">
                    <h3 className="text-lg font-black text-[#1e1b4b] tracking-tight">{title}</h3>
                    <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors p-1 bg-stone-50 rounded-md hover:bg-stone-100">
                        <Icon name="x" className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto bg-stone-50/30">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Modificação: Adicionado suporte nativo a propriedades (min, max, step) utilizando spread (...rest)
const Input = ({ label, type = 'text', value, onChange, placeholder, required, icon, ...rest }) => (
    <div className="mb-4">
        {label && <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">{label}</label>}
        <div className="relative group">
            {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 group-focus-within:text-[#f97316] transition-colors"><Icon name={icon} className="w-5 h-5"/></div>}
            <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} {...rest}
                   className={`w-full ${icon ? 'pl-10' : 'px-4'} py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none transition-all shadow-sm placeholder:text-stone-300`} />
        </div>
    </div>
);

const Badge = ({ children, variant = 'slate' }) => {
    const variants = {
        indigo: "bg-[#1e1b4b]/10 text-[#1e1b4b] border-[#1e1b4b]/20",
        emerald: "bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20",
        amber: "bg-[#eab308]/10 text-[#ca8a04] border-[#eab308]/30",
        orange: "bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20",
        slate: "bg-stone-100 text-stone-600 border-stone-200",
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${variants[variant]}`}>
            {children}
        </span>
    );
};

const HeroBanner = ({ title, subtitle, chips = [] }) => (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#1e1b4b] to-[#312e81] text-white p-6 sm:p-8 pb-8 shadow-[0_24px_50px_-24px_rgba(30,27,75,.6)]">
        <div className="dots-pattern absolute inset-0 opacity-60 pointer-events-none"></div>
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-[#f97316] blur-[70px] opacity-30 pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#16a34a] blur-[70px] opacity-25 pointer-events-none"></div>
        <div className="relative flex items-center justify-between gap-6">
            <div className="min-w-0">
                <p className="text-[#eab308] text-xs font-black uppercase tracking-[.25em] mb-2">{todayLabel()}</p>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">{title}</h2>
                {subtitle && <p className="text-indigo-200 text-sm font-medium mt-2">{subtitle}</p>}
                {chips.length > 0 && <div className="flex flex-wrap gap-2 mt-5">{chips.map(c => <span key={c} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold backdrop-blur-sm">{c}</span>)}</div>}
            </div>
            <div className="hidden sm:flex shrink-0 w-24 h-24 rounded-3xl bg-white items-center justify-center shadow-2xl ring-8 ring-white/10 logo-float"><LogoEscola className="w-14 h-14" /></div>
        </div>
        <div className="brand-stripe absolute bottom-0 left-0 right-0"></div>
    </div>
);

const LoginScreen = () => {
    const { login, allStudents } = useContext(AppContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        const user = username.trim().toLowerCase();
        
        if (user === 'gabriell' && password === '1058005') {
            login({ id: 'prof-gabriell', name: 'Prof. Gabriell', role: 'professor' });
        } else {
            const student = allStudents.find(s => s.username === user && s.password === password);
            if (student) {
                // Segurança: Não salva a senha no armazenamento do navegador
                const { password: _, ...safeStudentData } = student;
                login({ ...safeStudentData, role: 'student' });
            }
            else setError('Usuário ou senha incorretos.');
        }
    };

    return (
        <div className="min-h-screen flex bg-[#fefce8]">
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#1e1b4b] via-[#1e1b4b] to-[#312e81] dots-pattern text-white p-12 flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#f97316] rounded-full blur-[120px] opacity-20 -mr-40 -mt-40 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#16a34a] rounded-full blur-[100px] opacity-20 -ml-20 -mb-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl ring-8 ring-white/10 logo-float">
                        <LogoEscola className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">E.E. Edson Alves Pereira</h1>
                    <p className="text-[#eab308] font-bold text-xl uppercase tracking-widest">Portal Acadêmico</p>
                    <div className="flex flex-wrap gap-2 mt-8">
                        {[['Atividades', '#f97316'], ['Notas', '#eab308'], ['Frequência', '#16a34a'], ['Provas', '#a5b4fc']].map(([t, c]) => (
                            <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-white/90 backdrop-blur-sm"><span className="w-2 h-2 rounded-full" style={{ background: c }}></span>{t}</span>
                        ))}
                    </div>
                </div>
                <p className="text-indigo-200 text-sm relative z-10 font-medium">Montezuma/MG • Sistema de Gestão Educacional</p>
            </div>
            
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-sm animate-fade-in bg-white/85 backdrop-blur rounded-3xl border border-yellow-200 shadow-[0_24px_60px_-24px_rgba(30,27,75,.4)] overflow-hidden">
                    <div className="brand-stripe"></div>
                    <div className="p-8">
                    <div className="lg:hidden flex flex-col items-center mb-10">
                        <div className="w-16 h-16 bg-white shadow-lg border border-yellow-100 rounded-2xl flex items-center justify-center mb-4">
                            <LogoEscola className="w-10 h-10" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-[#1e1b4b] text-center">E.E. Edson A. Pereira</h1>
                    </div>
                    
                    <h2 className="text-3xl font-black text-[#1e1b4b] mb-2">Acesso restrito</h2>
                    <p className="text-sm text-stone-500 mb-8 font-medium">Insira suas credenciais para continuar.</p>

                    {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-bold">{error}</div>}
                    
                    <form onSubmit={handleLogin} className="space-y-5">
                        <Input label="Usuário de Acesso" icon="user" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        <Input label="Senha" type="password" icon="lock" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        <Button type="submit" className="w-full py-3.5 mt-4 text-base shadow-lg shadow-[#1e1b4b]/20">Entrar no Sistema</Button>
                    </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProfessorDashboard = ({ setCurrentView }) => {
    const { classes, allStudents, activities, submissions, grades, enrollments, attendance, user } = useContext(AppContext);
    const baixaFreq = lowAttendanceList(classes, enrollments, allStudents, attendance);
    const pendentes = submissions.filter(s => !grades.some(g => g.activityId === s.activityId && g.studentId === s.studentId));
    const emRisco = allStudents.map(st => {
        let ob = 0, pos = 0;
        grades.filter(g => g.studentId === st.id && g.grade !== 'Visto').forEach(g => {
            const act = activities.find(a => a.id === g.activityId);
            if (act && act.isGraded !== false) { ob += toNum(g.grade); pos += toNum(act.value); }
        });
        return { st, pct: percentOf(ob, pos), pos };
    }).filter(x => x.pos > 0 && x.pct < MEDIA_MINIMA).sort((a, b) => a.pct - b.pct);

    const exportGradebook = (cls) => {
        const ids = enrollments.filter(e => e.classId === cls.id).map(e => e.studentId);
        const students = allStudents.filter(s => ids.includes(s.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        const acts = activities.filter(a => a.classId === cls.id && a.isGraded !== false);
        const fmt = (n) => String(n).replace('.', ',');
        const lines = [['Aluno', ...acts.map(a => `${a.title} (${a.value} pts)`), 'Total', 'Possível', 'Aproveitamento %'].map(csvCell).join(';')];
        students.forEach(st => {
            let ob = 0, pos = 0;
            const cells = acts.map(a => {
                const g = grades.find(x => x.activityId === a.id && x.studentId === st.id);
                if (!g || g.grade === 'Visto') return '';
                ob += toNum(g.grade); pos += toNum(a.value);
                return fmt(toNum(g.grade));
            });
            lines.push([st.name, ...cells, fmt(ob), fmt(pos), percentOf(ob, pos).toFixed(1).replace('.', ',')].map(csvCell).join(';'));
        });
        downloadCSV(`notas-${String(cls.name).replace(/[^\w]+/g, '_')}.csv`, lines);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <HeroBanner title={`${greeting()}, ${user.name}`} subtitle="Resumo do seu ambiente educacional." chips={[`${classes.length} ${classes.length === 1 ? 'turma' : 'turmas'}`, `${allStudents.length} alunos`, `${pendentes.length} para corrigir`]} />
            
            <div className="grid-auto-cards">
                <MetricCard title="Turmas Ativas" value={classes.length} icon="book" onClick={() => setCurrentView('classes')} />
                <MetricCard title="Total de Alunos" value={allStudents.length} icon="users" onClick={() => setCurrentView('students')} />
                <MetricCard title="Atividades" value={activities.length} icon="file-text" onClick={() => setCurrentView('activities')} />
                <MetricCard title="Entregas" value={submissions.length} icon="download" onClick={() => setCurrentView('grading')} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <Card title={`Entregas para corrigir (${pendentes.length})`} noPadding>
                    <div className="divide-y divide-yellow-100">
                        {pendentes.length === 0 ? (
                            <div className="p-8 text-center text-stone-400 text-sm font-medium">Tudo corrigido. 🎉</div>
                        ) : pendentes.slice(0, 5).map(s => (
                            <button key={s.id} type="button" onClick={() => setCurrentView('grading')} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-yellow-50 transition-colors">
                                <div className="min-w-0">
                                    <p className="font-bold text-[#1e1b4b] text-sm truncate">{allStudents.find(st => st.id === s.studentId)?.name || 'Aluno removido'}</p>
                                    <p className="text-xs text-stone-500 font-semibold mt-0.5 truncate">{activities.find(a => a.id === s.activityId)?.title || 'Atividade removida'}</p>
                                </div>
                                <Badge variant="orange">Corrigir</Badge>
                            </button>
                        ))}
                    </div>
                </Card>
                <Card title={`Alunos abaixo de ${MEDIA_MINIMA}% (${emRisco.length})`} noPadding>
                    <div className="divide-y divide-yellow-100">
                        {emRisco.length === 0 ? (
                            <div className="p-8 text-center text-stone-400 text-sm font-medium">Nenhum aluno abaixo da média.</div>
                        ) : emRisco.slice(0, 5).map(({ st, pct }) => (
                            <div key={st.id} className="flex items-center justify-between gap-3 p-4">
                                <p className="font-bold text-[#1e1b4b] text-sm truncate">{st.name}</p>
                                <Badge variant="amber">{pct.toFixed(0)}%</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card title={`Frequência abaixo de ${FREQUENCIA_MINIMA}% (${baixaFreq.length})`} noPadding action={<Button variant="secondary" onClick={() => setCurrentView('attendance')}>Abrir chamada</Button>}>
                <div className="divide-y divide-yellow-100">
                    {baixaFreq.length === 0 ? (
                        <div className="p-8 text-center text-stone-400 text-sm font-medium">Nenhum aluno abaixo do mínimo de frequência.</div>
                    ) : baixaFreq.slice(0, 6).map(({ st, cls, pct }) => (
                        <div key={`${cls.id}-${st.id}`} className="flex items-center justify-between gap-3 p-4">
                            <div className="min-w-0"><p className="font-bold text-[#1e1b4b] text-sm truncate">{st.name}</p><p className="text-xs text-stone-500 font-semibold">{cls.name}</p></div>
                            <Badge variant="orange">{pct.toFixed(0)}%</Badge>
                        </div>
                    ))}
                </div>
            </Card>

            {classes.length > 0 && (
                <Card title="Exportar notas por turma (CSV)">
                    <div className="flex flex-wrap gap-3">
                        {classes.map(c => <Button key={c.id} variant="secondary" icon="download" onClick={() => exportGradebook(c)}>{c.name}</Button>)}
                    </div>
                </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
                <Card title="Acesso Rápido" noPadding>
                    <div className="flex flex-col divide-y divide-yellow-100">
                        <button onClick={() => setCurrentView('classes')} className="flex items-center justify-between p-5 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-2 bg-stone-50 rounded-lg group-hover:bg-[#f97316]/10 transition-colors"><Icon name="book" className="w-5 h-5 text-stone-400 group-hover:text-[#f97316]" /></div><span className="font-bold text-sm text-stone-700 group-hover:text-[#1e1b4b]">Gerenciar Turmas</span></div>
                            <Icon name="chevron-right" className="w-4 h-4 text-stone-300" />
                        </button>
                        <button onClick={() => setCurrentView('students')} className="flex items-center justify-between p-5 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-2 bg-stone-50 rounded-lg group-hover:bg-[#16a34a]/10 transition-colors"><Icon name="users" className="w-5 h-5 text-stone-400 group-hover:text-[#16a34a]" /></div><span className="font-bold text-sm text-stone-700 group-hover:text-[#1e1b4b]">Lista de Alunos</span></div>
                            <Icon name="chevron-right" className="w-4 h-4 text-stone-300" />
                        </button>
                        <button onClick={() => setCurrentView('activities')} className="flex items-center justify-between p-5 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-2 bg-stone-50 rounded-lg group-hover:bg-[#eab308]/10 transition-colors"><Icon name="plus" className="w-5 h-5 text-stone-400 group-hover:text-[#eab308]" /></div><span className="font-bold text-sm text-stone-700 group-hover:text-[#1e1b4b]">Nova Atividade</span></div>
                            <Icon name="chevron-right" className="w-4 h-4 text-stone-300" />
                        </button>
                        <button onClick={() => setCurrentView('grading')} className="flex items-center justify-between p-5 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-2 bg-stone-50 rounded-lg group-hover:bg-indigo-100 transition-colors"><Icon name="check-circle" className="w-5 h-5 text-stone-400 group-hover:text-[#1e1b4b]" /></div><span className="font-bold text-sm text-stone-700 group-hover:text-[#1e1b4b]">Lançar Notas</span></div>
                            <Icon name="chevron-right" className="w-4 h-4 text-stone-300" />
                        </button>
                    </div>
                </Card>
                
                <Card title="Atividades Recentes" noPadding>
                    <div className="divide-y divide-yellow-100">
                        {activities.length === 0 ? (
                            <div className="p-12 text-center text-stone-400 text-sm font-medium">Nenhuma atividade postada.</div>
                        ) : (
                            activities.slice(-4).reverse().map(act => {
                                const cls = classes.find(c => c.id === act.classId);
                                return (
                                    <div key={act.id} className="p-5 hover:bg-yellow-50 transition-colors flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-[#1e1b4b] text-sm">{act.title}</p>
                                            <p className="text-xs text-stone-500 mt-1 font-semibold">{cls?.name || 'Turma Excluída'} {act.subject ? `• ${act.subject}` : ''}</p>
                                        </div>
                                        <Badge variant="orange">{act.isGraded === false ? 'Visto' : `${act.value} pts`}</Badge>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

const ProfessorClasses = () => {
    const { classes, refreshData, allStudents, enrollments, activities, submissions, grades, exams, attendance } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [newClass, setNewClass] = useState({ id: null, name: '', description: '', subjects: '' });
    const [importing, setImporting] = useState(null);
    const [classToDelete, setClassToDelete] = useState(null);
    const [enrollSearch, setEnrollSearch] = useState('');

    const handleSaveClass = (e) => {
        e.preventDefault();
        const subjectsArray = newClass.subjects.split(',').map(s => s.trim()).filter(s => s);
        const classData = { 
            name: newClass.name, 
            description: newClass.description, 
            subjects: subjectsArray,
            professorId: 'prof-gabriell', 
            professorName: 'Prof. Gabriell' 
        };

        if (newClass.id) {
            dbService.update('classes', newClass.id, classData);
        } else {
            dbService.add('classes', classData);
        }
        
        setIsModalOpen(false);
        refreshData();
    };

    const handleEditClass = (cls) => {
        setNewClass({
            id: cls.id,
            name: cls.name,
            description: cls.description || '',
            subjects: cls.subjects ? cls.subjects.join(', ') : ''
        });
        setIsModalOpen(true);
    };

    // Exclusão em cascata: remove a turma e limpa registros órfãos vinculados a ela
    const confirmDeleteClass = async () => {
        if (!classToDelete) return;
        const id = classToDelete.id;
        setClassToDelete(null);
        await dbService.delete('classes', id);
        enrollments.filter(e => e.classId === id).forEach(e => dbService.delete('enrollments', e.id));
        activities.filter(a => a.classId === id).forEach(a => dbService.delete('activities', a.id));
        submissions.filter(s => s.classId === id).forEach(s => dbService.delete('submissions', s.id));
        grades.filter(g => g.classId === id).forEach(g => dbService.delete('grades', g.id));
        (exams || []).filter(ex => ex.classId === id).forEach(ex => dbService.delete('exams', ex.id));
        (attendance || []).filter(at => at.classId === id).forEach(at => dbService.delete('attendance', at.id));
    };

    const handleImport = async (className, rawNames, defaultSubjects) => {
        setImporting(className); // Avisa a interface que começou
        try {
            let cls = classes.find(c => c.name === className);
            if (!cls) {
                const id = Math.random().toString(36).substr(2, 9);
                cls = { id, name: className, description: 'Importado via SIMADE', subjects: defaultSubjects, professorId: 'prof-gabriell', professorName: 'Prof. Gabriell' };
                await dbService.add('classes', cls, id);
            } else if (!cls.subjects || cls.subjects.length === 0) {
                await dbService.update('classes', cls.id, { subjects: defaultSubjects });
            }
            
            const existingUsers = [...allStudents];
            let currentEnrollments = [...enrollments];
            const nameTracker = new Set(existingUsers.map(s => s.username));

            for (const fullName of rawNames) {
                const parts = fullName.split(' ');
                let baseUser = parts[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (nameTracker.has(baseUser)) baseUser = `${baseUser}.${parts[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
                nameTracker.add(baseUser);

                let student = existingUsers.find(s => s.name === fullName);
                if (!student) {
                    student = { name: fullName, username: baseUser, password: baseUser };
                    student = await dbService.add('students', student);
                    existingUsers.push(student);
                }

                if (!currentEnrollments.some(e => e.classId === cls.id && e.studentId === student.id)) {
                    const newEnroll = await dbService.add('enrollments', { classId: cls.id, studentId: student.id });
                    currentEnrollments.push(newEnroll);
                }
            }
        } finally {
            setImporting(null); // Libera a interface
        }
    };

    const toggleEnrollment = (studentId, isEnrolled, enrollmentId) => {
        if (isEnrolled) dbService.delete('enrollments', enrollmentId);
        else dbService.add('enrollments', { classId: selectedClass.id, studentId: studentId });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4">
                <div>
                    <h2 className="page-title">Gestão de Turmas</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={!!importing} onClick={() => handleImport("3º EMTI 1", [], ["Laboratório de informática"])} variant="secondary" icon="download">{importing === "3º EMTI 1" ? "Importando..." : "Imp. 3º EMTI 1"}</Button>
                    <Button disabled={!!importing} onClick={() => handleImport("3º EMTI 2", [], ["Laboratório de informática"])} variant="secondary" icon="download">{importing === "3º EMTI 2" ? "Importando..." : "Imp. 3º EMTI 2"}</Button>
                    <Button disabled={!!importing} onClick={() => handleImport("2º Informática", ["ADELSON SIMÕES DA CRUZ", "ALAN DANIEL DOS SANTOS SOUZA", "ALLEF CORDEIRO DANTAS", "ANA LUCIA SANTOS DE OLIVEIRA", "ANA PAULA FRANCISCA SILVEIRA", "ANGEANE ANTUNES DOS SANTOS PEREIRA", "CARLA APARECIDA CARVALHO PARDIM", "CRISTINA ROSALINA DE OLIVEIRA ROCHA", "DARLIANE RIBEIRO SOARES", "DOUGLAS MANOEL MARQUES BORBOREMA", "ELIENE SOARES COSTA", "EVANICE DA CRUZ RIBEIRO", "FRANCIELI DOS SANTOS FERREIRA", "GABRIELLY VITÓRIA ALMEIDA SOUZA", "GRACIANA MENDES", "HERIK JEAN DA SILVA SIMÕES", "KACIELLY ANTUNES DE OLIVEIRA", "KAROLINE DE OLIVEIRA MATIAS", "KAUANE ARAUJO COSTA", "LEONÊIDE ALVES SILVEIRA", "MILTON JOSE DA SILVA", "NUBIA NUNES DA SILVA", "PAULA DIAS DE SOUZA", "POLIANNY ALVES ANTUNES MORAIS", "RADIMILA SOUZA DO NASCIMENTO", "VANDERSON RODRIGUES DE SOUZA"], ["Desenvolvimento WEB", "Manutenção de computadores"])} variant="secondary" icon="download">{importing === "2º Informática" ? "Aguarde..." : "Imp. 2º Info"}</Button>
                    <Button disabled={!!importing} onClick={() => handleImport("3º Informática", ["ALAN PRATES LIMA", "CARLEANE RITA NERES", "DEIVID BRIAN DOS SANTOS PEREIRA", "DIVANIELE MORAIS SANTOS COSTA", "EDILENE CORDEIRO DO NASCIMENTO OLIVEIRA", "JOSINEIDE BISPO COSTA", "KAYQUE DE OLIVEIRA SOBRINHO", "KENEDY IGOR TOMAZ PEREIRA", "LUANNA RODRIGUES DA ROCHA", "RAFAELA NERES DA SILVA SILVEIRA", "RAILENE MENDES DIAS", "ROSIMAR MARIA DE SOUSA", "SELMA DE SALES PEREIRA"], ["Análise de projetos de sistemas"])} variant="secondary" icon="download">{importing === "3º Informática" ? "Aguarde..." : "Imp. 3º Info"}</Button>
                    <Button onClick={() => { setNewClass({ id: null, name: '', description: '', subjects: '' }); setIsModalOpen(true); }} icon="plus">Criar Turma</Button>
                </div>
            </div>

            <div className="grid-auto-cards">
                {classes.map(cls => (
                    <Card key={cls.id} className="hover:border-[#f97316] transition-colors border-t-4 border-t-[#f97316]">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-black text-lg text-[#1e1b4b] leading-tight">{cls.name}</h3>
                            <div className="flex gap-1 -mt-1 -mr-2">
                                <button type="button" onClick={() => handleEditClass(cls)} className="text-stone-400 hover:text-[#f97316] p-1.5 rounded-lg hover:bg-orange-50 transition-colors" title="Editar"><Icon name="edit" className="w-4 h-4"/></button>
                                <button type="button" onClick={() => setClassToDelete(cls)} className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Excluir"><Icon name="trash" className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <p className="text-sm text-stone-500 line-clamp-2 font-medium mb-3">{cls.description || 'Sem descrição.'}</p>
                        
                        {cls.subjects && cls.subjects.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-1">
                                {cls.subjects.map((sub, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                                        {sub}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-yellow-100">
                            <Badge variant="slate">{enrollments.filter(e => e.classId === cls.id).length} alunos</Badge>
                            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => { setSelectedClass(cls); setEnrollSearch(''); setIsManageModalOpen(true); }}>
                                Matrículas
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={newClass.id ? "Editar Turma" : "Nova Turma"}>
                <form onSubmit={handleSaveClass} className="space-y-4">
                    <Input label="Nome da Turma" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} required />
                    <div>
                        <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Descrição</label>
                        <textarea rows="2" value={newClass.description} onChange={e => setNewClass({...newClass, description: e.target.value})} className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none transition-all shadow-sm placeholder:text-stone-300"></textarea>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Matérias (separadas por vírgula)</label>
                        <textarea rows="2" placeholder="Ex: Desenvolvimento Web, Manutenção de Computadores" value={newClass.subjects} onChange={e => setNewClass({...newClass, subjects: e.target.value})} className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none transition-all shadow-sm placeholder:text-stone-300"></textarea>
                        <p className="text-xs text-stone-500 mt-1">Essas matérias estarão disponíveis ao criar atividades para esta turma.</p>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title={`Alunos: ${selectedClass?.name}`}>
                <div className="mb-3">
                    <Input icon="search" placeholder="Buscar aluno por nome ou usuário..." value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)} />
                </div>
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
                    {allStudents
                        .slice()
                        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                        .filter(s => !enrollSearch.trim() || s.name.toLowerCase().includes(enrollSearch.toLowerCase()) || s.username.toLowerCase().includes(enrollSearch.toLowerCase()))
                        .map(student => {
                            const enrollment = enrollments.find(e => e.classId === selectedClass?.id && e.studentId === student.id);
                            return (
                                <div key={student.id} className="flex justify-between items-center p-3 bg-stone-50 border border-yellow-200 rounded-lg">
                                    <div>
                                        <p className="font-bold text-sm text-[#1e1b4b]">{student.name}</p>
                                        <p className="text-xs text-stone-500 font-mono mt-0.5">@{student.username}</p>
                                    </div>
                                    <Button variant={enrollment ? "danger" : "secondary"} className="text-xs py-1.5 px-3" onClick={() => toggleEnrollment(student.id, !!enrollment, enrollment?.id)}>
                                        {enrollment ? 'Remover' : 'Adicionar'}
                                    </Button>
                                </div>
                            );
                        })}
                </div>
            </Modal>

            <Modal isOpen={!!classToDelete} onClose={() => setClassToDelete(null)} title="Excluir Turma">
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
                        Atenção: Excluir a turma <strong>{classToDelete?.name}</strong> removerá também todas as matrículas, atividades, chamadas e notas vinculadas a ela.
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setClassToDelete(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDeleteClass}>Sim, Excluir Turma</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const ProfessorStudents = () => {
    const { allStudents, enrollments, submissions, grades, classes } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', username: '', password: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [formError, setFormError] = useState('');
    const [studentToDelete, setStudentToDelete] = useState(null);

    const handleSave = (e) => {
        e.preventDefault();
        setFormError('');
        const cleanUsername = formData.username.trim().toLowerCase();
        const duplicate = allStudents.find(s => s.username.toLowerCase() === cleanUsername && s.id !== formData.id);
        if (duplicate) {
            setFormError(`O usuário "@${cleanUsername}" já está em uso por ${duplicate.name}.`);
            return;
        }
        const payload = { ...formData, name: formData.name.trim(), username: cleanUsername };
        if (formData.id) dbService.update('students', formData.id, payload);
        else dbService.add('students', payload);
        setIsModalOpen(false);
    };

    const confirmDeleteStudent = async () => {
        if (!studentToDelete) return;
        const id = studentToDelete.id;
        setStudentToDelete(null);
        await dbService.delete('students', id);
        enrollments.filter(e => e.studentId === id).forEach(e => dbService.delete('enrollments', e.id));
        submissions.filter(s => s.studentId === id).forEach(s => dbService.delete('submissions', s.id));
        grades.filter(g => g.studentId === id).forEach(g => dbService.delete('grades', g.id));
    };

    const filteredStudents = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return allStudents
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            .filter(s => !q || s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
    }, [allStudents, searchQuery]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
                <h2 className="page-title">Base de Alunos ({filteredStudents.length})</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
                    <div className="relative flex-1 sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                            <Icon name="search" className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar nome ou @usuário..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 outline-none shadow-sm"
                        />
                    </div>
                    <Button onClick={() => { setFormError(''); setFormData({id:null, name:'', username:'', password:''}); setIsModalOpen(true); }} icon="plus">Cadastrar</Button>
                </div>
            </div>

            <Card noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-yellow-200 bg-yellow-50/50">
                            <tr>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Nome Completo</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Turmas</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Usuário</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Senha Acesso</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-100">
                            {filteredStudents.map(s => {
                                const studentClasses = enrollments
                                    .filter(e => e.studentId === s.id)
                                    .map(e => classes.find(c => c.id === e.classId)?.name)
                                    .filter(Boolean);
                                return (
                                    <tr key={s.id} className="hover:bg-yellow-50/30 transition-colors">
                                        <td className="px-6 py-4 font-bold text-[#1e1b4b]">{s.name}</td>
                                        <td className="px-6 py-4">
                                            {studentClasses.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {studentClasses.map((cn, idx) => <Badge key={idx} variant="indigo">{cn}</Badge>)}
                                                </div>
                                            ) : <span className="text-xs text-stone-400 font-semibold">Sem turma</span>}
                                        </td>
                                        <td className="px-6 py-4 text-stone-500 font-mono text-xs">@{s.username}</td>
                                        <td className="px-6 py-4"><span className="text-xs bg-stone-100 border border-stone-200 font-mono font-bold text-stone-600 px-2.5 py-1 rounded-md">{s.password}</span></td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => { setFormError(''); setFormData(s); setIsModalOpen(true); }} className="text-stone-400 hover:text-[#f97316] p-2 rounded-lg hover:bg-orange-50 transition-colors" title="Editar"><Icon name="edit" className="w-4 h-4"/></button>
                                            <button onClick={() => setStudentToDelete(s)} className="text-stone-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Excluir"><Icon name="trash" className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastro de Aluno">
                <form onSubmit={handleSave} className="space-y-4">
                    {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">{formError}</div>}
                    <Input label="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <Input label="Usuário de Acesso" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
                    <Input label="Senha Temporária" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                    <div className="flex justify-end gap-3 mt-6"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar Registro</Button></div>
                </form>
            </Modal>

            <Modal isOpen={!!studentToDelete} onClose={() => setStudentToDelete(null)} title="Remover Aluno">
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
                        Tem certeza que deseja excluir o aluno <strong>{studentToDelete?.name}</strong>? Todas as matrículas, entregas e notas dele serão apagadas.
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setStudentToDelete(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDeleteStudent}>Sim, Excluir Aluno</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const ProfessorActivities = () => {
    const { activities, classes, submissions, grades } = useContext(AppContext);
    const [isFormView, setIsFormView] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [activityToDelete, setActivityToDelete] = useState(null);
    
    // Estado com suporte a instruções detalhadas, visto e material de apoio
    const [formData, setFormData] = useState({ 
        id: null, title: '', description: '', classId: '', subject: '', dueDate: '', 
        value: '', requiresSubmission: true, isGraded: true, 
        materialFileName: '', materialFileData: '' 
    });
    
    const [filterClassId, setFilterClassId] = useState('');

    const selectedClassObj = classes.find(c => c.id === formData.classId);
    const filteredActivities = filterClassId ? activities.filter(a => a.classId === filterClassId) : activities;

    const handleMaterialChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 700 * 1024) {
                setErrorMsg("O material de apoio deve ter no máximo 700 KB para suportar otimização do banco.");
                e.target.value = '';
                return;
            }
            setErrorMsg('');
            try {
                const base64 = await convertFileToBase64(file);
                setFormData({...formData, materialFileName: file.name, materialFileData: base64});
            } catch (err) {
                setErrorMsg("Erro ao processar arquivo.");
            }
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        
        // Se for visto (sem nota), limpa o valor para não bagunçar
        const dataToSave = { ...formData };
        if (!dataToSave.isGraded) {
            dataToSave.value = 0;
        }

        if (formData.id) dbService.update('activities', formData.id, dataToSave);
        else dbService.add('activities', dataToSave);
        setIsFormView(false);
    };

    const confirmDeleteActivity = async () => {
        if (!activityToDelete) return;
        const id = activityToDelete.id;
        setActivityToDelete(null);
        await dbService.delete('activities', id);
        submissions.filter(s => s.activityId === id).forEach(s => dbService.delete('submissions', s.id));
        grades.filter(g => g.activityId === id).forEach(g => dbService.delete('grades', g.id));
    };

    if (isFormView) {
        return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4 pb-4 border-b border-yellow-200">
                    <button onClick={() => setIsFormView(false)} className="p-2 bg-white border border-yellow-200 rounded-lg text-stone-500 hover:text-[#1e1b4b] hover:bg-yellow-50 transition-colors"><Icon name="chevron-right" className="w-5 h-5 rotate-180"/></button>
                    <h2 className="page-title">{formData.id ? "Editar Avaliação" : "Nova Avaliação"}</h2>
                </div>

                <Card>
                    <form onSubmit={handleSave} className="space-y-5">
                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded-lg font-bold">
                                {errorMsg}
                            </div>
                        )}
                        
                        <Input label="Título da Atividade" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Estudo de Caso — Redes Locais" required />

                        <div>
                            <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Instruções / Enunciado (Opcional)</label>
                            <textarea
                                rows="3"
                                value={formData.description || ''}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                placeholder="Explique passo a passo o que o aluno deve fazer, critérios de avaliação ou orientações..."
                                className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none transition-all shadow-sm placeholder:text-stone-300"
                            ></textarea>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Turma de Aplicação</label>
                            <select className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none shadow-sm" 
                                value={formData.classId} 
                                onChange={e => setFormData({...formData, classId: e.target.value, subject: ''})} required>
                                <option value="">Selecione a turma...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {selectedClassObj && selectedClassObj.subjects && selectedClassObj.subjects.length > 0 && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Matéria</label>
                                <select className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none shadow-sm" 
                                    value={formData.subject} 
                                    onChange={e => setFormData({...formData, subject: e.target.value})} required>
                                    <option value="">Selecione a matéria...</option>
                                    {selectedClassObj.subjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Input type="date" label="Data Limite" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                            
                            <div className="flex flex-col justify-end pb-4">
                                <label className="flex items-center gap-2 cursor-pointer p-2 border border-green-200 bg-green-50 rounded-lg transition-colors hover:bg-green-100">
                                    <input type="checkbox" checked={formData.isGraded} onChange={e => setFormData({...formData, isGraded: e.target.checked})} className="w-4 h-4 text-[#16a34a]"/> 
                                    <span className="text-sm font-bold text-[#16a34a]">Atividade Vale Nota?</span>
                                </label>
                            </div>
                        </div>

                        {formData.isGraded && (
                            <div className="animate-fade-in">
                                <Input type="number" step="0.1" min="0" label="Valor Máximo (pts)" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} required />
                            </div>
                        )}

                        <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <label className="block text-sm font-bold text-indigo-900 mb-2">Anexar Material de Apoio (Opcional)</label>
                            <p className="text-xs text-indigo-700 mb-3">Envie um arquivo (PDF, Word, Imagem) para os alunos usarem nesta atividade. Limite: 700 KB.</p>
                            
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-sm font-bold transition-colors">
                                    <Icon name="upload" className="w-4 h-4"/> Escolher arquivo
                                    <input type="file" className="hidden" onChange={handleMaterialChange} accept=".pdf,.docx,.txt,.jpeg,.jpg,.png" />
                                </label>
                                <span className="text-sm text-indigo-900 font-medium truncate flex-1">
                                    {formData.materialFileName ? formData.materialFileName : 'Nenhum material anexado.'}
                                </span>
                            </div>
                            
                            {formData.materialFileName && (
                                <button type="button" onClick={() => setFormData({...formData, materialFileName: '', materialFileData: ''})} className="mt-2 text-xs text-red-600 font-bold hover:underline">
                                    Remover anexo
                                </button>
                            )}
                        </div>

                        <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-xl mt-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" checked={formData.requiresSubmission} onChange={e => setFormData({...formData, requiresSubmission: e.target.checked})} className="mt-1 w-5 h-5 text-[#16a34a] border-yellow-300 rounded focus:ring-[#16a34a]"/> 
                                <div>
                                    <span className="block text-sm font-bold text-[#1e1b4b]">Exige Envio Digital do Aluno</span>
                                    <span className="block text-xs font-medium text-stone-500 mt-1">Desmarque se for apenas leitura ou avaliação em sala física.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-yellow-100">
                            <Button variant="secondary" onClick={() => setIsFormView(false)}>Cancelar</Button>
                            <Button type="submit">{formData.id ? "Salvar Alterações" : "Publicar Atividade"}</Button>
                        </div>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
                <h2 className="page-title">Atividades Publicadas</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <select
                        className="px-4 py-2 bg-white border border-yellow-200 rounded-lg text-sm font-bold text-stone-700 focus:ring-2 focus:ring-[#16a34a] outline-none shadow-sm"
                        value={filterClassId}
                        onChange={e => setFilterClassId(e.target.value)}
                    >
                        <option value="">Todas as Turmas</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button onClick={() => { setFormData({ id: null, title: '', description: '', classId: '', subject: '', dueDate: '', value: '', requiresSubmission: true, isGraded: true, materialFileName: '', materialFileData: '' }); setIsFormView(true); }} icon="plus">Publicar Nova</Button>
                </div>
            </div>

            <div className="grid-auto-cards">
                {filteredActivities.slice().reverse().map(act => {
                    const cls = classes.find(c => c.id === act.classId);
                    const subCount = submissions.filter(s => s.activityId === act.id).length;
                    return (
                        <Card key={act.id} className={`hover:border-[#16a34a] border-t-4 ${act.isGraded === false ? 'border-t-slate-400' : 'border-t-[#16a34a]'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-wrap gap-2">
                                    {act.isGraded === false ? (
                                        <Badge variant="slate">Visto (Sem Nota)</Badge>
                                    ) : (
                                        <Badge variant="emerald">{act.value} pts</Badge>
                                    )}
                                    {act.requiresSubmission !== false && <Badge variant="indigo">{subCount} {subCount === 1 ? 'entrega' : 'entregas'}</Badge>}
                                </div>
                                <div className="flex gap-1 -mt-2 -mr-2">
                                    <button type="button" onClick={() => { setFormData({...act, description: act.description || '', isGraded: act.isGraded !== false}); setIsFormView(true); }} className="text-stone-400 hover:text-[#f97316] p-2 rounded-lg hover:bg-orange-50 transition-colors" title="Editar"><Icon name="edit" className="w-4 h-4"/></button>
                                    <button type="button" onClick={() => setActivityToDelete(act)} className="text-stone-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Excluir"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <h3 className="font-black text-lg text-[#1e1b4b] leading-tight">{act.title}</h3>
                            <p className="text-sm font-bold text-stone-500 mt-1.5">{cls?.name}</p>
                            {act.description && <p className="text-xs text-stone-600 mt-2 line-clamp-2 font-medium">{act.description}</p>}
                            
                            {act.subject && (
                                <div className="mt-2 flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-max">
                                    <Icon name="tag" className="w-3 h-3 mr-1" /> {act.subject}
                                </div>
                            )}

                            {act.materialFileName && (
                                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-700">
                                    <Icon name="file-text" className="w-4 h-4" /> Material Anexado
                                </div>
                            )}

                            <div className="mt-4 pt-4 flex items-center text-xs font-bold uppercase tracking-wide text-stone-400 gap-2 border-t border-yellow-100">
                                <Icon name="clock" className="w-4 h-4" /> 
                                {act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : 'Sem prazo limite'}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Modal isOpen={!!activityToDelete} onClose={() => setActivityToDelete(null)} title="Excluir Atividade">
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold">
                        Tem certeza que deseja excluir a atividade <strong>{activityToDelete?.title}</strong>? Todas as respostas enviadas e notas atribuídas a ela serão perdidas.
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setActivityToDelete(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDeleteActivity}>Sim, Excluir</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const ProfessorGrading = () => {
    const { activities, classes, allStudents, enrollments, grades, submissions } = useContext(AppContext);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [viewSubmission, setViewSubmission] = useState(null);
    const [modalGrade, setModalGrade] = useState('');
    const [modalFeedback, setModalFeedback] = useState('');
    const [isSavingModal, setIsSavingModal] = useState(false);
    const [saveStatus, setSaveStatus] = useState({});

    const currentAct = activities.find(a => a.id === selectedActivity);
    const selectedClassObj = classes.find(c => c.id === selectedClassId);
    
    const studentsInClass = useMemo(() => {
        if (!currentAct) return [];
        const classEnrolls = enrollments.filter(e => e.classId === currentAct.classId).map(e => e.studentId);
        return allStudents.filter(s => classEnrolls.includes(s.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [currentAct, enrollments, allStudents]);

    const gradingStats = useMemo(() => {
        if (!currentAct || studentsInClass.length === 0) return null;
        const actGrades = grades.filter(g => g.activityId === currentAct.id && studentsInClass.some(s => s.id === g.studentId));
        const actSubs = submissions.filter(s => s.activityId === currentAct.id && studentsInClass.some(st => st.id === s.studentId));
        const numeric = actGrades.filter(g => g.grade !== 'Visto').map(g => toNum(g.grade));
        const avg = numeric.length > 0 ? (numeric.reduce((a, b) => a + b, 0) / numeric.length) : null;
        return {
            totalStudents: studentsInClass.length,
            submittedCount: actSubs.length,
            gradedCount: actGrades.length,
            avg
        };
    }, [currentAct, studentsInClass, grades, submissions]);

    const markSaved = (studentId) => {
        setSaveStatus(prev => ({ ...prev, [studentId]: 'saved' }));
        setTimeout(() => {
            setSaveStatus(prev => ({ ...prev, [studentId]: null }));
        }, 1800);
    };

    const openSubmissionModal = (student, sub) => {
        const existingGrade = grades.find(g => g.activityId === currentAct.id && g.studentId === student.id);
        setModalGrade(existingGrade?.grade !== undefined ? String(existingGrade.grade) : '');
        setModalFeedback(existingGrade?.feedback || '');
        setViewSubmission({ student, sub });
    };

    const handleSaveModalEvaluation = async () => {
        if (!viewSubmission || !currentAct) return;
        setIsSavingModal(true);
        const studentId = viewSubmission.student.id;
        const existing = grades.find(g => g.activityId === currentAct.id && g.studentId === studentId);
        const feedbackClean = modalFeedback.trim();

        try {
            if (currentAct.isGraded === false) {
                const payload = { activityId: currentAct.id, studentId, classId: currentAct.classId, grade: 'Visto', feedback: feedbackClean };
                if (existing) await dbService.update('grades', existing.id, payload);
                else await dbService.add('grades', payload);
            } else if (modalGrade !== '') {
                let numValue = parseFloat(String(modalGrade).replace(',', '.'));
                const maxVal = Number(currentAct.value);
                if (Number.isNaN(numValue)) numValue = 0;
                if (numValue < 0) numValue = 0;
                if (numValue > maxVal) numValue = maxVal;
                numValue = Math.round(numValue * 100) / 100;
                const payload = { activityId: currentAct.id, studentId, classId: currentAct.classId, grade: numValue, feedback: feedbackClean };
                if (existing) await dbService.update('grades', existing.id, payload);
                else await dbService.add('grades', payload);
            } else if (existing && feedbackClean) {
                await dbService.update('grades', existing.id, { feedback: feedbackClean });
            }
            markSaved(studentId);
            setViewSubmission(null);
        } finally {
            setIsSavingModal(false);
        }
    };

    const handleBatchVisto = async () => {
        if (!currentAct || currentAct.isGraded !== false) return;
        const targets = currentAct.requiresSubmission !== false
            ? studentsInClass.filter(s => submissions.some(sub => sub.activityId === currentAct.id && sub.studentId === s.id))
            : studentsInClass;
        for (const st of targets) {
            const existing = grades.find(g => g.activityId === currentAct.id && g.studentId === st.id);
            if (!existing || existing.grade !== 'Visto') {
                if (existing) await dbService.update('grades', existing.id, { grade: 'Visto' });
                else await dbService.add('grades', { activityId: currentAct.id, studentId: st.id, classId: currentAct.classId, grade: 'Visto' });
            }
        }
    };

    const handleGrade = async (studentId, rawValue, e) => {
        const existing = grades.find(g => g.activityId === currentAct.id && g.studentId === studentId);
        
        // Se apagar o valor
        if (rawValue === '') {
            if (existing) {
                setSaveStatus(prev => ({ ...prev, [studentId]: 'saving' }));
                await dbService.delete('grades', existing.id);
                markSaved(studentId);
            }
            if (e) e.target.value = '';
            return;
        }

        // Se for atividade de visto
        if (currentAct.isGraded === false) {
            setSaveStatus(prev => ({ ...prev, [studentId]: 'saving' }));
            if (existing) {
                if (existing.grade !== 'Visto') await dbService.update('grades', existing.id, { grade: 'Visto' });
            } else {
                await dbService.add('grades', { activityId: currentAct.id, studentId: studentId, classId: currentAct.classId, grade: 'Visto' });
            }
            markSaved(studentId);
            return;
        }

        // Lógica de nota numérica (suporta vírgula ou ponto)
        let numValue = parseFloat(String(rawValue).replace(',', '.'));
        if (Number.isNaN(numValue)) {
            if (e) e.target.value = existing?.grade ?? '';
            return;
        }
        const maxVal = Number(currentAct.value);
        
        if (numValue < 0) numValue = 0;
        if (numValue > maxVal) numValue = maxVal;
        numValue = Math.round(numValue * 100) / 100;
        
        if (e) e.target.value = numValue;

        if (existing) {
            if (Number(existing.grade) !== numValue) {
                setSaveStatus(prev => ({ ...prev, [studentId]: 'saving' }));
                await dbService.update('grades', existing.id, { grade: numValue });
                markSaved(studentId);
            }
        } else {
            setSaveStatus(prev => ({ ...prev, [studentId]: 'saving' }));
            await dbService.add('grades', { activityId: currentAct.id, studentId: studentId, classId: currentAct.classId, grade: numValue });
            markSaved(studentId);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="pb-4 border-b border-yellow-200">
                <h2 className="page-title">Lançamento de Notas / Vistos</h2>
            </div>
            
            <div className="max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={selectedClassObj && selectedClassObj.subjects?.length > 0 ? "" : "md:col-span-2"}>
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Filtrar por Turma:</label>
                    <select 
                        className="w-full px-4 py-3.5 bg-white border border-yellow-200 rounded-xl text-sm font-bold text-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] outline-none shadow-sm" 
                        value={selectedClassId} 
                        onChange={e => {
                            setSelectedClassId(e.target.value);
                            setSelectedSubject('');
                            setSelectedActivity('');
                        }}
                    >
                        <option value="">-- Todas as turmas --</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                
                {selectedClassObj && selectedClassObj.subjects && selectedClassObj.subjects.length > 0 && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Filtrar por Matéria:</label>
                        <select 
                            className="w-full px-4 py-3.5 bg-white border border-yellow-200 rounded-xl text-sm font-bold text-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] outline-none shadow-sm" 
                            value={selectedSubject} 
                            onChange={e => {
                                setSelectedSubject(e.target.value);
                                setSelectedActivity('');
                            }}
                        >
                            <option value="">-- Todas as matérias --</option>
                            {selectedClassObj.subjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                        </select>
                    </div>
                )}
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Escolher Avaliação / Atividade:</label>
                    <select 
                        className="w-full px-4 py-3.5 bg-white border border-yellow-200 rounded-xl text-sm font-bold text-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] outline-none shadow-sm" 
                        value={selectedActivity} 
                        onChange={e => setSelectedActivity(e.target.value)}
                    >
                        <option value="">-- Escolha na lista --</option>
                        {activities
                            .filter(a => selectedClassId === '' || a.classId === selectedClassId)
                            .filter(a => selectedSubject === '' || a.subject === selectedSubject)
                            .map(a => <option key={a.id} value={a.id}>{a.title} {a.isGraded === false ? '[VISTO]' : ''} - {classes.find(c=>c.id===a.classId)?.name}</option>)
                        }
                    </select>
                </div>
            </div>

            {currentAct && (
                <Card noPadding className={`mt-4 border-t-4 ${currentAct.isGraded === false ? 'border-t-slate-500' : 'border-t-[#1e1b4b]'}`}>
                    <div className="p-6 border-b border-yellow-100 bg-yellow-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex flex-wrap gap-2 items-center mb-2">
                                <h3 className="font-black text-xl text-[#1e1b4b]">{currentAct.title}</h3>
                                {currentAct.subject && <Badge variant="indigo">{currentAct.subject}</Badge>}
                            </div>
                            {currentAct.isGraded === false ? (
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wide">Atividade Formativa (Apenas Visto)</p>
                            ) : (
                                <p className="text-sm font-bold text-stone-500 uppercase tracking-wide">Valor Máximo: {currentAct.value} pts</p>
                            )}
                            {gradingStats && (
                                <div className="flex flex-wrap gap-3 mt-3 text-xs font-bold text-stone-600">
                                    <span className="px-2.5 py-1 rounded-md bg-white border border-yellow-200">Avaliados: {gradingStats.gradedCount}/{gradingStats.totalStudents}</span>
                                    {currentAct.requiresSubmission !== false && (
                                        <span className="px-2.5 py-1 rounded-md bg-white border border-yellow-200">Entregas: {gradingStats.submittedCount}/{gradingStats.totalStudents}</span>
                                    )}
                                    {currentAct.isGraded !== false && gradingStats.avg !== null && (
                                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">Média da turma: {gradingStats.avg.toFixed(1)} pts</span>
                                    )}
                                </div>
                            )}
                        </div>
                        {currentAct.isGraded === false && (
                            <Button variant="secondary" icon="check-circle" onClick={handleBatchVisto}>
                                {currentAct.requiresSubmission !== false ? 'Dar Visto aos Entregues' : 'Dar Visto a Todos'}
                            </Button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="border-b border-yellow-200 bg-white">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Aluno</th>
                                    {currentAct.requiresSubmission !== false && (
                                        <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Resposta do Aluno</th>
                                    )}
                                    <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs w-48 text-center">
                                        {currentAct.isGraded === false ? "Visto" : "Nota Obtida"}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-yellow-100">
                                {studentsInClass.map(s => {
                                    const grade = grades.find(g => g.activityId === currentAct.id && g.studentId === s.id);
                                    const submission = submissions.find(sub => sub.activityId === currentAct.id && sub.studentId === s.id);
                                    
                                    return (
                                        <tr key={`${s.id}-${currentAct.id}`} className="hover:bg-yellow-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-[#1e1b4b] block">{s.name}</span>
                                                {grade?.feedback && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 mt-0.5">
                                                        <Icon name="message" className="w-3 h-3" /> Feedback enviado
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {currentAct.requiresSubmission !== false && (
                                                <td className="px-6 py-4">
                                                    {submission ? (
                                                        <Button variant="secondary" className="py-1 px-2.5 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" onClick={() => openSubmissionModal(s, submission)}>
                                                            <Icon name="eye" className="w-3 h-3 mr-1" /> Ver e Avaliar
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs font-bold text-stone-400">Pendente</span>
                                                    )}
                                                </td>
                                            )}

                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex flex-col items-center gap-1">
                                                    {currentAct.isGraded === false ? (
                                                        <button
                                                            onClick={() => handleGrade(s.id, grade?.grade === 'Visto' ? '' : 'Visto')}
                                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm ${grade?.grade === 'Visto' ? 'bg-[#16a34a] text-white border border-transparent' : 'bg-white text-stone-600 border border-stone-300 hover:bg-stone-50'}`}
                                                        >
                                                            {grade?.grade === 'Visto' ? ( <><Icon name="check-circle" className="w-3 h-3 inline mr-1 -mt-0.5"/> Dado</>) : 'Dar Visto'}
                                                        </button>
                                                    ) : (
                                                        <input type="number" 
                                                            step="0.1"
                                                            key={`input-${s.id}-${currentAct.id}-${grade?.grade ?? ''}`}
                                                            min="0"
                                                            max={currentAct.value}
                                                            className="w-24 px-3 py-2 border border-yellow-300 rounded-lg text-center font-black text-lg text-[#1e1b4b] focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] outline-none shadow-sm bg-white" 
                                                            defaultValue={grade?.grade !== undefined ? grade.grade : ''} 
                                                            onBlur={e => handleGrade(s.id, e.target.value, e)} 
                                                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                            placeholder="-" 
                                                        />
                                                    )}
                                                    {saveStatus[s.id] === 'saving' && <span className="text-[10px] font-bold text-amber-600">Salvando...</span>}
                                                    {saveStatus[s.id] === 'saved' && <span className="text-[10px] font-bold text-emerald-600">✓ Salvo</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal isOpen={!!viewSubmission} onClose={() => setViewSubmission(null)} title={`Avaliar: ${viewSubmission?.student?.name}`}>
                {viewSubmission && (
                    <div className="space-y-4">
                        <div className="p-4 bg-white border border-yellow-200 rounded-xl">
                            <p className="text-xs font-bold text-stone-500 uppercase mb-2">
                                {currentAct?.isGraded === false ? 'Conclusão / Comentário do Aluno:' : 'Texto da Resposta:'}
                            </p>
                            <p className="text-sm text-stone-800 whitespace-pre-wrap">{viewSubmission.sub.textResponse || 'Nenhum texto digitado.'}</p>
                        </div>
                        
                        {viewSubmission.sub.fileData && (
                            <div className="space-y-3">
                                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Icon name="file-text" className="w-6 h-6 text-indigo-600 shrink-0"/>
                                        <span className="font-bold text-sm text-indigo-900 truncate">{viewSubmission.sub.fileName}</span>
                                    </div>
                                    <a href={viewSubmission.sub.fileData} download={viewSubmission.sub.fileName} className="shrink-0 ml-4 flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                                        <Icon name="download" className="w-4 h-4"/> Baixar
                                    </a>
                                </div>
                                {viewSubmission.sub.fileData.startsWith('data:image/') && (
                                    <div className="border border-yellow-200 rounded-xl overflow-hidden bg-white p-2">
                                        <img src={viewSubmission.sub.fileData} alt={viewSubmission.sub.fileName} className="max-h-80 w-auto mx-auto rounded-lg object-contain" />
                                    </div>
                                )}
                                {viewSubmission.sub.fileData.startsWith('data:application/pdf') && (
                                    <iframe src={viewSubmission.sub.fileData} title={viewSubmission.sub.fileName} className="w-full h-80 rounded-xl border border-yellow-200 bg-white" />
                                )}
                            </div>
                        )}

                        <div className="p-4 bg-yellow-50/70 border border-yellow-200 rounded-xl space-y-3">
                            {currentAct?.isGraded !== false && (
                                <div>
                                    <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1">
                                        Nota (Máx: {currentAct?.value} pts)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max={currentAct?.value}
                                        value={modalGrade}
                                        onChange={e => setModalGrade(e.target.value)}
                                        placeholder="Ex: 8.5"
                                        className="w-36 px-3 py-2 bg-white border border-yellow-300 rounded-xl text-base font-black text-[#1e1b4b] outline-none"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1">
                                    Feedback / Devolutiva para o Aluno (Opcional)
                                </label>
                                <textarea
                                    rows="2"
                                    value={modalFeedback}
                                    onChange={e => setModalFeedback(e.target.value)}
                                    placeholder="Escreva um elogio, correção ou orientação sobre a entrega..."
                                    className="w-full px-3 py-2 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-800 outline-none"
                                ></textarea>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setViewSubmission(null)}>Cancelar</Button>
                            <Button icon="check-circle" disabled={isSavingModal} onClick={handleSaveModalEvaluation}>
                                {isSavingModal ? 'Salvando...' : (currentAct?.isGraded === false ? 'Confirmar Visto e Feedback' : 'Salvar Avaliação')}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const ProfessorExams = () => {
    const { exams, classes } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, title: '', classId: '', subject: '', examDate: '' });

    const selectedClassObj = classes.find(c => c.id === formData.classId);

    const handleSave = (e) => {
        e.preventDefault();
        if (formData.id) dbService.update('exams', formData.id, formData);
        else dbService.add('exams', formData);
        setIsModalOpen(false);
    };

    const handleDelete = (id) => dbService.delete('exams', id);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center pb-4 border-b border-yellow-200">
                <h2 className="page-title">Agenda de Provas</h2>
                <Button onClick={() => { setFormData({ id: null, title: '', classId: '', subject: '', examDate: '' }); setIsModalOpen(true); }} icon="plus">Marcar Prova</Button>
            </div>

            <div className="grid-auto-cards">
                {(exams || []).slice().sort((a,b) => new Date(a.examDate) - new Date(b.examDate)).map(exam => {
                    const cls = classes.find(c => c.id === exam.classId);
                    return (
                        <Card key={exam.id} className="hover:border-indigo-500 border-l-4 border-l-indigo-600 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-black text-lg text-[#1e1b4b] leading-tight">{exam.title}</h3>
                                <div className="flex gap-1 -mt-1 -mr-2">
                                    <button type="button" onClick={() => { setFormData(exam); setIsModalOpen(true); }} className="text-stone-400 hover:text-[#f97316] p-1.5 rounded-lg hover:bg-orange-50 transition-colors"><Icon name="edit" className="w-4 h-4"/></button>
                                    <button type="button" onClick={() => handleDelete(exam.id)} className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <p className="text-sm font-bold text-stone-500 mb-2">{cls?.name} {exam.subject && `• ${exam.subject}`}</p>
                            <div className="mt-4 pt-4 border-t border-yellow-100 flex items-center gap-2 text-indigo-700 font-black text-sm bg-indigo-50 p-3 rounded-lg">
                                <Icon name="calendar" className="w-5 h-5" />
                                {exam.examDate ? new Date(exam.examDate + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Sem data definida'}
                            </div>
                        </Card>
                    );
                })}
                {(!exams || exams.length === 0) && (
                    <div className="col-span-full p-8 text-center text-stone-500 font-bold bg-white rounded-xl border border-yellow-200">
                        Nenhuma prova agendada no momento.
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? "Editar Prova" : "Marcar Nova Prova"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Título (Ex: Prova Bimestral)" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Nome da avaliação..." required />
                    
                    <div>
                        <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Turma</label>
                        <select className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none shadow-sm" 
                            value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value, subject: ''})} required>
                            <option value="">Selecione a turma...</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {selectedClassObj && selectedClassObj.subjects && selectedClassObj.subjects.length > 0 && (
                        <div className="animate-fade-in">
                            <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">Matéria</label>
                            <select className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none shadow-sm" 
                                value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required>
                                <option value="">Selecione a matéria...</option>
                                {selectedClassObj.subjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                            </select>
                        </div>
                    )}

                    <Input type="date" label="Data da Prova" value={formData.examDate} onChange={e => setFormData({...formData, examDate: e.target.value})} required />

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-yellow-100">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Agendamento</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

const ProfessorAttendance = () => {
    const { classes, allStudents, enrollments, attendance } = useContext(AppContext);
    const [classId, setClassId] = useState('');
    const [date, setDate] = useState(todayISO());
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const fieldCls = "w-full px-4 py-3 rounded-xl border border-yellow-200 bg-white text-sm font-medium text-stone-900 focus:outline-none focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316]";

    const students = useMemo(() => {
        const ids = enrollments.filter(e => e.classId === classId).map(e => e.studentId);
        return allStudents.filter(s => ids.includes(s.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }, [classId, enrollments, allStudents]);
    const classDays = useMemo(() => attendance.filter(a => a.classId === classId && a.records).sort((a, b) => b.date.localeCompare(a.date)), [attendance, classId]);
    const existing = attendance.find(a => a.id === `${classId}_${date}`);
    const existingStamp = existing ? existing.createdAt : null;

    useEffect(() => {
        setMsg('');
        setDraft(existing ? { ...existing.records } : Object.fromEntries(students.map(s => [s.id, 'P'])));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classId, date, existingStamp, students.length]);

    const cycle = (id) => setDraft(prev => ({ ...prev, [id]: { P: 'F', F: 'J', J: 'P' }[prev[id] || 'P'] }));
    const todayCounts = calcFrequency(students.map(s => draft[s.id] || 'P'));
    const rows = students.map(st => ({ st, ...calcFrequency(classDays.map(d => d.records[st.id]).filter(Boolean)) }));

    const save = async () => {
        if (!classId || !date || students.length === 0) return;
        setSaving(true); setMsg('');
        try {
            const id = `${classId}_${date}`;
            const records = Object.fromEntries(students.map(s => [s.id, draft[s.id] || 'P']));
            await dbService.add('attendance', { id, classId, date, records }, id);
            setMsg('Chamada salva!');
        } catch (e) { console.error(e); setMsg('Erro ao salvar. Tente novamente.'); }
        setSaving(false);
    };

    const exportFrequency = () => {
        const cls = classes.find(c => c.id === classId);
        const lines = [['Aluno', 'Aulas', 'Presenças', 'Faltas', 'Justificadas', 'Frequência %'].map(csvCell).join(';')];
        rows.forEach(r => lines.push([r.st.name, r.total, r.p, r.f, r.j, r.pct === null ? '' : r.pct.toFixed(1).replace('.', ',')].map(csvCell).join(';')));
        downloadCSV(`frequencia-${String(cls?.name || 'turma').replace(/[^\w]+/g, '_')}.csv`, lines);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <header>
                <h2 className="page-title">Chamada e Frequência</h2>
                <p className="text-stone-500 text-sm font-medium mt-1">Toque no status do aluno para alternar: Presente, Falta e Justificada.</p>
            </header>

            <Card>
                <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-black text-stone-600 uppercase tracking-wider">Turma
                        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${fieldCls} mt-1.5`}>
                            <option value="">Selecione a turma</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-xs font-black text-stone-600 uppercase tracking-wider">Data da aula
                        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} className={`${fieldCls} mt-1.5`} />
                    </label>
                </div>
            </Card>

            {classId && students.length === 0 && (
                <div className="p-8 text-center text-stone-500 font-bold bg-white rounded-xl border border-yellow-200">Esta turma ainda não tem alunos matriculados.</div>
            )}

            {classId && students.length > 0 && (
                <>
                    <Card title={`Chamada de ${fmtDateBR(date)}${existing ? ' (já registrada)' : ''}`} action={<Button variant="secondary" onClick={() => setDraft(Object.fromEntries(students.map(s => [s.id, 'P'])))}>Todos presentes</Button>} noPadding>
                        <div className="divide-y divide-yellow-100">
                            {students.map(s => {
                                const v = draft[s.id] || 'P';
                                return (
                                    <div key={s.id} className="flex items-center justify-between gap-3 px-6 py-3">
                                        <p className="font-bold text-[#1e1b4b] text-sm truncate">{s.name}</p>
                                        <button type="button" onClick={() => cycle(s.id)} className={`shrink-0 min-w-[110px] px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider transition-colors active:scale-95 ${ATT_INFO[v].cls}`}>{ATT_INFO[v].label}</button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-yellow-100 bg-yellow-50/50 rounded-b-xl">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">{todayCounts.p} presentes • {todayCounts.f} faltas • {todayCounts.j} justificadas</p>
                            <div className="flex items-center gap-3">
                                {msg && <span className="text-xs font-bold text-stone-600">{msg}</span>}
                                <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar chamada'}</Button>
                            </div>
                        </div>
                    </Card>

                    <Card title={`Frequência da turma (${classDays.length} ${classDays.length === 1 ? 'aula' : 'aulas'})`} action={<Button variant="secondary" icon="download" onClick={exportFrequency}>CSV</Button>} noPadding>
                        {classDays.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-6 pt-4">
                                {classDays.slice(0, 12).map(d => (
                                    <button key={d.id} type="button" onClick={() => setDate(d.date)} className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${d.date === date ? 'bg-[#1e1b4b] text-white border-transparent' : 'bg-white text-stone-600 border-yellow-200 hover:bg-yellow-50'}`}>{fmtDateBR(d.date)}</button>
                                ))}
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap mt-2">
                                <thead className="border-b border-yellow-200 bg-yellow-50">
                                    <tr>
                                        <th className="px-6 py-3 font-bold text-stone-600 uppercase tracking-wider text-xs">Aluno</th>
                                        <th className="px-4 py-3 font-bold text-stone-600 uppercase tracking-wider text-xs text-center">Pres.</th>
                                        <th className="px-4 py-3 font-bold text-stone-600 uppercase tracking-wider text-xs text-center">Faltas</th>
                                        <th className="px-4 py-3 font-bold text-stone-600 uppercase tracking-wider text-xs text-center">Just.</th>
                                        <th className="px-6 py-3 font-black text-[#1e1b4b] uppercase tracking-wider text-xs text-center">Frequência</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-yellow-100">
                                    {rows.map(r => (
                                        <tr key={r.st.id} className="hover:bg-yellow-50/50">
                                            <td className="px-6 py-3 font-bold text-[#1e1b4b]">{r.st.name}</td>
                                            <td className="px-4 py-3 text-center font-bold text-stone-500">{r.p}</td>
                                            <td className="px-4 py-3 text-center font-bold text-stone-500">{r.f}</td>
                                            <td className="px-4 py-3 text-center font-bold text-stone-500">{r.j}</td>
                                            <td className="px-6 py-3 text-center"><Badge variant={r.pct === null ? 'slate' : r.pct >= FREQUENCIA_MINIMA ? 'emerald' : 'orange'}>{r.pct === null ? '—' : `${r.pct.toFixed(1)}%`}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

const StudentAttendance = () => {
    const { user, enrollments, classes, attendance } = useContext(AppContext);
    const myClasses = classes.filter(c => enrollments.some(e => e.studentId === user.id && e.classId === c.id));
    const blocks = myClasses.map(c => {
        const days = attendance.filter(a => a.classId === c.id && a.records && a.records[user.id]).sort((a, b) => b.date.localeCompare(a.date));
        return { c, days, ...calcFrequency(days.map(d => d.records[user.id])) };
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="page-title">Minha Frequência</h2>
            {blocks.length === 0 && <div className="p-8 text-center text-stone-500 font-bold bg-white rounded-xl border border-yellow-200">Você ainda não está matriculado em nenhuma turma.</div>}
            {blocks.map(({ c, days, total, p, f, j, pct }) => (
                <Card key={c.id} title={c.name}>
                    <div className="flex flex-wrap items-center gap-6">
                        <div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Frequência</p>
                            <p className={`text-5xl font-black tracking-tight mt-1 ${pct === null ? 'text-stone-400' : pct >= FREQUENCIA_MINIMA ? 'text-[#16a34a]' : 'text-[#f97316]'}`}>{pct === null ? '—' : `${pct.toFixed(1)}%`}</p>
                        </div>
                        <div className="text-sm font-bold text-stone-600 space-y-1">
                            <p>{total} {total === 1 ? 'aula registrada' : 'aulas registradas'}</p>
                            <p>{p} presenças • {f} faltas • {j} justificadas</p>
                            {pct !== null && pct < FREQUENCIA_MINIMA && <Badge variant="orange">Abaixo de {FREQUENCIA_MINIMA}% — atenção às faltas</Badge>}
                        </div>
                    </div>
                    {days.some(d => d.records[user.id] !== 'P') && (
                        <div className="mt-5 pt-4 border-t border-yellow-100">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Faltas registradas</p>
                            <div className="flex flex-wrap gap-2">
                                {days.filter(d => d.records[user.id] !== 'P').map(d => (
                                    <span key={d.id} className={`px-2.5 py-1 rounded-md text-xs font-bold border ${ATT_INFO[d.records[user.id]].cls}`}>{fmtDateBR(d.date)} • {ATT_INFO[d.records[user.id]].label}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );
};

const StudentDashboard = ({ setCurrentView }) => {
    const { user, enrollments, grades, activities, exams, classes, submissions } = useContext(AppContext);
    const myClassesIds = enrollments.filter(e => e.studentId === user.id).map(e => e.classId);
    
    // A fazer: atividades sem nota, ordenadas pelo prazo
    const todoList = activities
        .filter(a => myClassesIds.includes(a.classId))
        .map(a => {
            const sub = submissions.find(x => x.activityId === a.id && x.studentId === user.id);
            const g = grades.find(x => x.activityId === a.id && x.studentId === user.id);
            return { act: a, status: getActivityStatus(a, sub, g), when: describeDue(a) };
        })
        .filter(i => i.status.key === 'todo' || i.status.key === 'late')
        .sort((x, y) => dueTime(x.act) - dueTime(y.act));

    // Pegar provas
    const myExams = (exams || [])
        .filter(e => myClassesIds.includes(e.classId))
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

    // Pegar notas que não sejam 'Visto'
    const notasReais = grades.filter(g => g.studentId === user.id && g.grade !== 'Visto').length;
    
    return (
        <div className="space-y-8 animate-fade-in">
            <HeroBanner title={`${greeting()}, ${user.name.split(' ')[0]}!`} subtitle="Veja o que há de novo nas suas turmas." chips={[`${todoList.length} a fazer`, `${myClassesIds.length} ${myClassesIds.length === 1 ? 'turma' : 'turmas'}`]} />
            
            <div className="grid-auto-cards">
                <MetricCard title="Minhas Turmas" value={myClassesIds.length} icon="book" />
                <MetricCard title="Tarefas" value={activities.filter(a => myClassesIds.includes(a.classId)).length} icon="file-text" onClick={() => setCurrentView('activities')} />
                <MetricCard title="Notas Lançadas" value={notasReais} icon="check-circle" onClick={() => setCurrentView('grades')} />
            </div>

            {todoList.length > 0 && (
                <Card title={`A fazer (${todoList.length})`} noPadding>
                    <div className="divide-y divide-yellow-100">
                        {todoList.slice(0, 5).map(({ act, status, when }) => (
                            <button key={act.id} type="button" onClick={() => setCurrentView('activities')} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-yellow-50 transition-colors">
                                <div className="min-w-0">
                                    <p className="font-bold text-[#1e1b4b] text-sm truncate">{act.title}</p>
                                    <p className="text-xs text-stone-500 font-semibold mt-0.5">{classes.find(c => c.id === act.classId)?.name} {act.subject ? `• ${act.subject}` : ''} • {when}</p>
                                </div>
                                <Badge variant={status.variant}>{status.label}</Badge>
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            {myExams.length > 0 && (
                <div className="mt-8 animate-fade-in">
                    <h3 className="text-xl font-black text-[#1e1b4b] mb-4 flex items-center gap-2">
                        <Icon name="calendar" className="w-6 h-6 text-indigo-600" />
                        Minha Agenda de Provas
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {myExams.map(exam => (
                            <div key={exam.id} className="bg-white p-5 rounded-xl border-l-4 border-l-indigo-600 border-y border-r border-y-yellow-200 border-r-yellow-200 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                                <p className="text-xs font-bold text-stone-500 uppercase mb-1">{classes.find(c => c.id === exam.classId)?.name} {exam.subject && `• ${exam.subject}`}</p>
                                <p className="font-black text-[#1e1b4b] text-lg leading-tight mb-3">{exam.title}</p>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold">
                                    <Icon name="calendar" className="w-4 h-4"/> 
                                    {exam.examDate ? new Date(exam.examDate + 'T12:00:00Z').toLocaleDateString('pt-BR') : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-yellow-200 mt-8">
                <Button variant="secondary" onClick={() => setCurrentView('activities')} className="py-8 justify-start px-8 shadow-sm hover:border-[#f97316]"><Icon name="file-text" className="w-6 h-6 text-[#f97316] mr-3"/> <span className="font-black text-base">Ver Minhas Atividades</span></Button>
                <Button variant="secondary" onClick={() => setCurrentView('grades')} className="py-8 justify-start px-8 shadow-sm hover:border-[#16a34a]"><Icon name="check-circle" className="w-6 h-6 text-[#16a34a] mr-3"/> <span className="font-black text-base">Acessar Boletim Escolar</span></Button>
            </div>
        </div>
    );
};

const StudentActivities = () => {
    const { user, activities, classes, enrollments, submissions, grades } = useContext(AppContext);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [textResponse, setTextResponse] = useState('');
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [cancelTarget, setCancelTarget] = useState(null);
    const [filterClassId, setFilterClassId] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const myClassesIds = enrollments.filter(e => e.studentId === user.id).map(e => e.classId);
    const available = activities.filter(a => myClassesIds.includes(a.classId));
    const filteredAvailable = available
        .filter(a => !filterClassId || a.classId === filterClassId)
        .filter(a => {
            if (statusFilter === 'all') return true;
            const sub = submissions.find(s => s.activityId === a.id && s.studentId === user.id);
            const gr = grades.find(g => g.activityId === a.id && g.studentId === user.id);
            const st = getActivityStatus(a, sub, gr).key;
            if (statusFilter === 'pending') return st === 'todo' || st === 'late';
            if (statusFilter === 'done') return st === 'submitted' || st === 'graded';
            return true;
        });
    const myClasses = classes.filter(c => myClassesIds.includes(c.id));

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            if (selected.size > 700 * 1024) {
                setErrorMsg("O arquivo é muito grande. Para esta versão, o limite rigoroso é 700 KB.");
                e.target.value = '';
                setFile(null);
                return;
            }
            setErrorMsg('');
            setFile(selected);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMsg('');

        try {
            let fileDataString = null;
            let finalFileName = null;

            if (file) {
                fileDataString = await convertFileToBase64(file);
                finalFileName = file.name;
            }

            const submissionData = {
                activityId: selectedActivity.id,
                studentId: user.id,
                classId: selectedActivity.classId,
                textResponse: textResponse,
                fileName: finalFileName,
                fileData: fileDataString
            };

            const existing = submissions.find(s => s.activityId === selectedActivity.id && s.studentId === user.id);
            if (existing) {
                await dbService.update('submissions', existing.id, submissionData);
            } else {
                await dbService.add('submissions', submissionData);
            }

            setSelectedActivity(null);
            setTextResponse('');
            setFile(null);
        } catch (error) {
            console.error("Erro no envio:", error);
            setErrorMsg("Ocorreu um erro ao enviar sua atividade. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
                <h2 className="page-title">Quadro de Atividades</h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="inline-flex rounded-xl bg-white border border-yellow-200 p-1 shadow-sm">
                        {[['all', 'Todas'], ['pending', 'Pendentes'], ['done', 'Concluídas']].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setStatusFilter(key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${statusFilter === key ? 'bg-[#1e1b4b] text-white shadow-sm' : 'text-stone-500 hover:text-[#1e1b4b]'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <select
                        className="w-full sm:w-auto px-4 py-2.5 bg-white border border-yellow-200 rounded-xl text-sm font-bold text-stone-800 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none shadow-sm"
                        value={filterClassId}
                        onChange={e => setFilterClassId(e.target.value)}
                    >
                        <option value="">Todas as Minhas Turmas</option>
                        {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
                {filteredAvailable.slice().sort((a, b) => {
                    const timeA = a.dueDate ? new Date(a.dueDate).getTime() : (a.createdAt || 0);
                    const timeB = b.dueDate ? new Date(b.dueDate).getTime() : (b.createdAt || 0);
                    return timeB - timeA;
                }).map(act => {
                    const mySubmission = submissions.find(s => s.activityId === act.id && s.studentId === user.id);
                    const myGrade = grades.find(g => g.activityId === act.id && g.studentId === user.id);
                    const statusInfo = getActivityStatus(act, mySubmission, myGrade);

                    return (
                        <Card key={act.id} className={`flex flex-col md:flex-row gap-0 p-0 border-l-4 ${act.isGraded === false ? 'border-l-slate-400' : 'border-l-[#eab308]'}`}>
                            <div className="flex-1 p-6">
                                <div className="flex flex-wrap items-center gap-2">
                                    {act.isGraded === false ? (
                                        <Badge variant="slate">Visto de Participação (Sem Nota)</Badge>
                                    ) : (
                                        <Badge variant="amber">Valor Máximo: {act.value} pts</Badge>
                                    )}
                                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                                </div>
                                
                                <h3 className="text-xl font-black text-[#1e1b4b] mt-3">{act.title}</h3>
                                <p className="text-sm font-bold text-stone-500 mt-1">{classes.find(c=>c.id===act.classId)?.name}</p>
                                {act.description && (
                                    <p className="mt-3 p-3 bg-yellow-50/70 border border-yellow-100 rounded-xl text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                                        {act.description}
                                    </p>
                                )}
                                
                                {act.subject && (
                                    <div className="mt-2 flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-max">
                                        <Icon name="tag" className="w-3 h-3 mr-1" /> {act.subject}
                                    </div>
                                )}
                                
                                {act.materialFileData && (
                                    <a href={act.materialFileData} download={act.materialFileName} className="inline-flex items-center gap-2 px-3 py-2 mt-4 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors shadow-sm">
                                        <Icon name="download" className="w-4 h-4"/> Baixar Material ({act.materialFileName})
                                    </a>
                                )}

                                {myGrade?.feedback && (
                                    <div className="mt-4 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                                            <Icon name="message" className="w-3.5 h-3.5" /> Comentário do Professor
                                        </p>
                                        <p className="text-sm font-medium text-emerald-950 whitespace-pre-wrap">{myGrade.feedback}</p>
                                    </div>
                                )}

                                <div className="mt-5 pt-4 border-t border-yellow-100 text-xs font-bold uppercase tracking-wide text-[#f97316] flex items-center gap-2">
                                    <Icon name="clock" className="w-4 h-4"/> Prazo de Entrega: {act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : 'Sem prazo definido'}
                                </div>
                            </div>
                            
                            {act.requiresSubmission !== false ? (
                                <div className="md:w-64 bg-stone-50 p-6 border-l border-yellow-100 flex flex-col justify-center gap-3 shrink-0">
                                    {mySubmission ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-center p-3 border border-[#16a34a]/30 bg-[#16a34a]/10 rounded-lg">
                                                <Icon name="check-circle" className="w-6 h-6 text-[#16a34a] mx-auto mb-1"/>
                                                <p className="text-xs font-bold text-[#16a34a] uppercase">
                                                    {myGrade ? (myGrade.grade === 'Visto' ? 'Visto Confirmado' : `Nota: ${myGrade.grade} / ${act.value}`) : 'Enviado'}
                                                </p>
                                            </div>
                                            {!myGrade && (
                                                <Button variant="secondary" className="text-xs py-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={() => setCancelTarget(mySubmission.id)}>
                                                    Desfazer Envio
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <Button className="w-full bg-gradient-to-br from-[#f97316] to-[#c2410c] hover:shadow-lg hover:shadow-[#f97316]/25 hover:-translate-y-px active:translate-y-0 text-white" onClick={() => { setSelectedActivity(act); setErrorMsg(''); }}>Responder Agora</Button>
                                    )}
                                </div>
                            ) : (
                                <div className="md:w-64 bg-[#16a34a]/10 p-6 border-l border-[#16a34a]/20 flex flex-col justify-center items-center text-center shrink-0">
                                    <Icon name="check-circle" className="w-8 h-8 text-[#16a34a] mb-2"/>
                                    <p className="text-sm font-black text-[#1e1b4b] uppercase">Atividade Presencial</p>
                                    <p className="text-xs font-bold text-stone-600 mt-1">
                                        {myGrade ? `Avaliado: ${myGrade.grade === 'Visto' ? 'Visto' : `${myGrade.grade} pts`}` : 'Aguarde o lançamento do professor'}
                                    </p>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            <Modal isOpen={!!selectedActivity} onClose={() => !isSubmitting && setSelectedActivity(null)} title={`Responder: ${selectedActivity?.title}`}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded-lg font-bold">
                            {errorMsg}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-xs font-black text-stone-600 uppercase tracking-wider mb-1.5">
                            {selectedActivity?.isGraded === false ? 'Sua Conclusão / Comentário (Texto)' : 'Sua Resposta (Texto)'}
                        </label>
                        <textarea 
                            rows="4" 
                            value={textResponse} 
                            onChange={e => setTextResponse(e.target.value)} 
                            placeholder={selectedActivity?.isGraded === false ? "Escreva aqui a sua conclusão sobre o material..." : "Digite sua resposta aqui se não for enviar um arquivo..."}
                            className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:ring-4 focus:ring-[#f97316]/15 focus:border-[#f97316] outline-none transition-all shadow-sm placeholder:text-stone-300"
                        ></textarea>
                    </div>

                    <div className="p-4 border border-yellow-200 bg-white rounded-xl shadow-sm">
                        <label className="block text-sm font-bold text-stone-700 mb-3">Anexar Arquivo</label>
                        
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex gap-3 items-start">
                            <Icon name="tag" className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">Atenção: Limite Máximo de 700 KB</p>
                                <p className="text-xs font-medium text-orange-700 leading-relaxed">
                                    O sistema utiliza armazenamento otimizado. Por favor, envie documentos leves. Se for uma foto do caderno, reduza a qualidade da câmera.
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-stone-500 mb-3 font-medium">Formatos permitidos: PDF, DOCX, TXT, JPEG, PNG.</p>
                        
                        <div className="flex items-center gap-3">
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 rounded-lg text-sm font-bold transition-colors">
                                <Icon name="upload" className="w-4 h-4"/> Escolher arquivo
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                    accept=".pdf,.docx,.txt,.jpeg,.jpg,.png"
                                />
                            </label>
                            <span className="text-sm text-stone-600 font-medium truncate flex-1">
                                {file ? file.name : 'Nenhum arquivo.'}
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-yellow-100">
                        <Button variant="secondary" onClick={() => setSelectedActivity(null)} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting || (!textResponse.trim() && !file)}>
                            {isSubmitting ? 'Enviando...' : 'Enviar Resposta'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Desfazer Envio">
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-bold shadow-sm">
                        Atenção: Ao desfazer o envio, sua resposta atual (texto e arquivo anexado) será apagada permanentemente do sistema.
                    </div>
                    <p className="text-stone-600 text-sm font-medium">Tem certeza que deseja apagar sua resposta e fazer de novo?</p>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-yellow-100 mt-2">
                        <Button variant="secondary" onClick={() => setCancelTarget(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={async () => {
                            await dbService.delete('submissions', cancelTarget);
                            setCancelTarget(null);
                        }}>Sim, Apagar Resposta</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const StudentGrades = () => {
    const { user, grades, activities, classes } = useContext(AppContext);
    
    // Ignorar atividades que são "Visto" para o cálculo do boletim
    const myGrades = grades
        .filter(g => g.studentId === user.id)
        .map(g => ({
            grade: g, act: activities.find(a => a.id === g.activityId) || {}, cls: classes.find(c => c.id === g.classId) || {}
        }))
        .filter(item => item.act.isGraded !== false);

    const groupedGrades = myGrades.reduce((acc, current) => {
        const subject = current.act.subject || 'Geral/Sem Matéria';
        if (!acc[subject]) acc[subject] = { totalObtido: 0, totalPossivel: 0, items: [] };
        acc[subject].items.push(current);
        acc[subject].totalObtido += Number(current.grade.grade || 0);
        acc[subject].totalPossivel += Number(current.act.value || 0);
        return acc;
    }, {});

    let globalObtido = Math.round(myGrades.reduce((a, c) => a + Number(c.grade.grade || 0), 0) * 100) / 100;
    let globalPossivel = Math.round(myGrades.reduce((a, c) => a + Number(c.act.value || 0), 0) * 100) / 100;
    const globalPercent = globalPossivel > 0 ? ((globalObtido/globalPossivel)*100).toFixed(1) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2">
                <h2 className="page-title">Meu Boletim Escolar</h2>
                <Button variant="secondary" icon="printer" onClick={() => window.print()}>Imprimir / Salvar PDF</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#1e1b4b] rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[50px] opacity-10 -mr-10 -mt-10"></div>
                    <p className="text-indigo-200 text-sm font-bold uppercase tracking-wider">Aproveitamento Global</p>
                    <p className="text-6xl font-black mt-3 tracking-tight">{globalPercent}%</p>
                    <div className="mt-4 w-full h-2.5 bg-white/15 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#f97316] via-[#eab308] to-[#16a34a] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Number(globalPercent))}%` }}></div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-yellow-200 shadow-sm flex flex-col justify-center">
                    <p className="text-stone-500 text-sm font-bold uppercase tracking-wider">Pontos Globais</p>
                    <p className="text-5xl font-black text-[#16a34a] mt-3 tracking-tight">{globalObtido} <span className="text-xl font-bold text-stone-400 lowercase">pts</span></p>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-yellow-200 shadow-sm flex flex-col justify-center">
                    <p className="text-stone-500 text-sm font-bold uppercase tracking-wider">Total Distribuído</p>
                    <p className="text-5xl font-black text-[#1e1b4b] mt-3 tracking-tight">{globalPossivel} <span className="text-xl font-bold text-stone-400 lowercase">pts</span></p>
                </div>
            </div>

            {Object.entries(groupedGrades).map(([subject, data], idx) => {
                const percentSubject = data.totalPossivel > 0 ? ((data.totalObtido / data.totalPossivel) * 100).toFixed(1) : 0;
                
                return (
                    <div key={idx} className="mb-8">
                        <div className="flex items-center justify-between bg-[#f97316] text-white px-6 py-4 rounded-t-2xl rounded-b-none shadow-sm">
                            <h3 className="font-black text-lg uppercase tracking-wide flex items-center gap-2">
                                <Icon name="book" className="w-5 h-5"/> {subject}
                            </h3>
                            <div className="text-right">
                                <span className="text-sm font-bold opacity-90 block uppercase tracking-wider text-[10px]">Aproveitamento: {percentSubject}% • {Number(percentSubject) >= MEDIA_MINIMA ? '✓ Na média' : '⚠ Abaixo da média'}</span>
                                <span className="font-black text-xl">{Math.round(data.totalObtido * 100) / 100} / {Math.round(data.totalPossivel * 100) / 100} pts</span>
                            </div>
                        </div>
                        
                        <Card noPadding className="shadow-sm border-t-0 rounded-t-none">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="border-b border-yellow-200 bg-yellow-50">
                                        <tr>
                                            <th className="px-6 py-4 font-bold text-stone-600 uppercase tracking-wider text-xs">Avaliação</th>
                                            <th className="px-6 py-4 font-bold text-stone-600 uppercase tracking-wider text-xs text-center">Data</th>
                                            <th className="px-6 py-4 font-bold text-stone-600 uppercase tracking-wider text-xs text-center">Valor Total</th>
                                            <th className="px-6 py-4 font-black text-[#1e1b4b] uppercase tracking-wider text-xs text-center">Nota Final</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-yellow-100">
                                        {data.items.map(({grade, act, cls}) => (
                                            <tr key={grade.id} className="hover:bg-yellow-50/50">
                                                <td className="px-6 py-4">
                                                    <span className="block font-black text-base text-[#1e1b4b]">{act.title}</span>
                                                    <span className="block font-bold text-xs text-stone-500 mt-1">{cls.name}</span>
                                                    {grade.feedback && (
                                                        <span className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 whitespace-normal">
                                                            <Icon name="message" className="w-3.5 h-3.5 shrink-0" /> {grade.feedback}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-stone-500">{act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : '-'}</td>
                                                <td className="px-6 py-4 text-center font-bold text-stone-500">{act.value} pts</td>
                                                <td className="px-6 py-4 text-center font-black text-2xl text-[#16a34a]">{grade.grade}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                );
            })}
            
            {Object.keys(groupedGrades).length === 0 && (
                <div className="p-8 text-center text-stone-500 font-bold bg-white rounded-xl border border-yellow-200">
                    Nenhuma nota lançada ainda. As atividades de Visto não aparecem no boletim.
                </div>
            )}
        </div>
    );
};

const MainApp = () => {
    const { user, logout, activities, enrollments, allStudents } = useContext(AppContext);
    const [currentView, setCurrentView] = useState(() => {
        const hash = window.location.hash.replace('#', '');
        return hash || 'dashboard';
    });
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isProf = user.role === 'professor';

    // Aviso de atividade nova (aluno) sincronizado diretamente com o documento do aluno no Firestore
    const currentStudentDoc = useMemo(() => (isProf ? null : allStudents.find(s => s.id === user.id)), [isProf, allStudents, user.id]);
    const sessionStart = useRef(Date.now());
    const notifiedIds = useRef(new Set());
    const myClassIds = useMemo(() => (isProf ? [] : enrollments.filter(e => e.studentId === user.id).map(e => e.classId)), [isProf, enrollments, user.id]);
    const newActivities = useMemo(() => {
        if (isProf) return [];
        const last = currentStudentDoc?.lastSeenActivities || sessionStart.current;
        return activities.filter(a => myClassIds.includes(a.classId) && (a.createdAt || 0) > last).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [isProf, activities, myClassIds, currentStudentDoc]);

    useEffect(() => {
        if (isProf || currentView !== 'activities' || !currentStudentDoc) return;
        dbService.update('students', user.id, { lastSeenActivities: Date.now() }).catch(() => {});
    }, [currentView, isProf, activities.length, currentStudentDoc, user.id]);

    // Notificação do aparelho (funciona com o app aberto; para avisar com o app fechado seria preciso push/FCM)
    const [notifPerm, setNotifPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
    useEffect(() => {
        if (isProf || notifPerm !== 'granted') return;
        activities.forEach(a => {
            if (!myClassIds.includes(a.classId) || (a.createdAt || 0) <= sessionStart.current || notifiedIds.current.has(a.id)) return;
            notifiedIds.current.add(a.id);
            try { new Notification('Nova atividade', { body: a.title + (a.subject ? ` • ${a.subject}` : '') }); } catch (e) { /* ignorado */ }
        });
    }, [activities, myClassIds, notifPerm, isProf]);
    const askNotifPermission = async () => { try { setNotifPerm(await Notification.requestPermission()); } catch (e) { /* ignorado */ } };


    const menu = isProf ? 
        [
            { id: 'dashboard', label: 'Painel Geral', icon: 'home' }, 
            { id: 'classes', label: 'Turmas', icon: 'book' }, 
            { id: 'students', label: 'Alunos', icon: 'users' }, 
            { id: 'exams', label: 'Agenda de Provas', icon: 'calendar' },
            { id: 'attendance', label: 'Chamada', icon: 'users' },
            { id: 'activities', label: 'Atividades', icon: 'file-text' }, 
            { id: 'grading', label: 'Lançar Notas', icon: 'check-circle' }
        ] 
        : [{ id: 'dashboard', label: 'Meu Painel', icon: 'home' }, { id: 'activities', label: 'Atividades', icon: 'file-text' }, { id: 'grades', label: 'Boletim Escolar', icon: 'check-circle' }, { id: 'frequency', label: 'Frequência', icon: 'clock' }];

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && menu.some(item => item.id === hash)) setCurrentView(hash);
            else setCurrentView('dashboard');
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [menu]);

    const handleNavigate = (id) => {
        window.location.hash = id;
        setCurrentView(id);
        setIsMobileMenuOpen(false);
    };

    const renderView = () => {
        if (isProf) {
            if (currentView === 'classes') return <ProfessorClasses />;
            if (currentView === 'students') return <ProfessorStudents />;
            if (currentView === 'exams') return <ProfessorExams />;
            if (currentView === 'attendance') return <ProfessorAttendance />;
            if (currentView === 'activities') return <ProfessorActivities />;
            if (currentView === 'grading') return <ProfessorGrading />;
            return <ProfessorDashboard setCurrentView={handleNavigate} />;
        } else {
            if (currentView === 'activities') return <StudentActivities />;
            if (currentView === 'grades') return <StudentGrades />;
            if (currentView === 'frequency') return <StudentAttendance />;
            return <StudentDashboard setCurrentView={handleNavigate} />;
        }
    };

    const SidebarContent = () => (
        <>
            <div className="brand-stripe shrink-0"></div>
            <div className="h-16 border-b border-yellow-200 flex items-center px-6 shrink-0 justify-between bg-white shadow-sm z-10">
                <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-xl bg-[#fefce8] border border-yellow-200 flex items-center justify-center shadow-sm"><LogoEscola className="w-7 h-7" /></span>
                    <div><span className="block font-black text-sm tracking-tight text-[#1e1b4b] uppercase leading-tight">E.E. Edson<br/>A. Pereira</span></div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-stone-400 hover:text-[#1e1b4b] p-1 bg-stone-50 rounded">
                    <Icon name="x" className="w-5 h-5"/>
                </button>
            </div>
            
            <div className="px-6 py-5 border-b border-yellow-100 bg-white flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#f97316] via-[#eab308] to-[#16a34a] text-white font-black flex items-center justify-center shadow-sm">{String(user.name || '?').trim().charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                <p className="font-black text-[#1e1b4b] text-sm truncate">{user.name}</p>
                <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mt-1">{user.role === 'professor' ? 'Professor' : 'Aluno'}</p>
                {!isProf && notifPerm === 'default' && <button type="button" onClick={askNotifPermission} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#f97316] hover:underline"><Icon name="bell" className="w-3.5 h-3.5" /> Ativar avisos neste aparelho</button>}
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1 bg-white">
                {menu.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button key={item.id} onClick={() => handleNavigate(item.id)} 
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
                            ${isActive ? 'bg-gradient-to-r from-[#f97316]/15 to-[#eab308]/10 text-[#c2410c] shadow-[inset_3px_0_0_#f97316]' : 'text-stone-500 hover:bg-stone-50 hover:text-[#1e1b4b] hover:translate-x-0.5'}`}>
                            <Icon name={item.icon} className={`w-5 h-5 ${isActive ? 'text-[#f97316]' : 'text-stone-400'}`} />
                            {item.label}
                            {item.id === 'activities' && newActivities.length > 0 && <span className="ml-auto bg-[#f97316] text-white text-[10px] font-black rounded-full px-2 py-0.5">{newActivities.length} {newActivities.length === 1 ? 'nova' : 'novas'}</span>}
                        </button>
                    )
                })}
            </nav>

            <div className="p-5 border-t border-yellow-100 shrink-0 bg-white">
                <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-stone-50 text-stone-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                    <Icon name="log-out" className="w-4 h-4"/> Sair do Sistema
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen w-full bg-[#fefce8] font-sans text-stone-900 overflow-hidden relative selection:bg-yellow-200">
            {isMobileMenuOpen && <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity" />}
            
            <aside className={`absolute lg:static top-0 left-0 h-full w-64 bg-white flex flex-col border-r border-yellow-200 z-50 shrink-0 transition-transform duration-200 ease-in-out ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
                <SidebarContent />
            </aside>
            
            <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#fefce8]">
                <div className="brand-stripe lg:hidden shrink-0"></div>
                <header className="h-16 flex-shrink-0 bg-white border-b border-yellow-200 flex items-center px-4 lg:px-10 justify-between z-10 lg:hidden shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="p-1.5 -ml-1.5 text-stone-500 hover:text-[#1e1b4b] hover:bg-yellow-50 rounded-md transition-colors border border-transparent hover:border-yellow-200">
                            <Icon name="menu" className="w-5 h-5" />
                        </button>
                        <h1 className="font-bold text-stone-800 text-sm tracking-wide uppercase">
                            {menu.find(m => m.id === currentView)?.label}
                        </h1>
                    </div>
                    {!isProf && newActivities.length > 0 && (
                        <button type="button" aria-label="Novas atividades" onClick={() => handleNavigate('activities')} className="relative p-2 text-[#f97316]">
                            <Icon name="bell" className="w-5 h-5" />
                            <span className="absolute -top-0.5 -right-0.5 bg-[#f97316] text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center">{newActivities.length}</span>
                        </button>
                    )}
                </header>
                
                <div className="hidden lg:flex h-16 shrink-0 items-center justify-between px-10 bg-white/70 backdrop-blur border-b border-yellow-200">
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-[#f97316] to-[#eab308]"></span>
                        <p className="font-black text-[#1e1b4b] text-sm uppercase tracking-widest">{menu.find(m => m.id === currentView)?.label || 'Painel'}</p>
                    </div>
                    <p className="text-xs font-bold text-stone-500 capitalize">{todayLabel()}</p>
                </div>
                <main className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
                    <div className="max-w-5xl mx-auto pb-12">
                        {!isProf && newActivities.length > 0 && currentView !== 'activities' && (
                            <button type="button" onClick={() => handleNavigate('activities')} className="w-full mb-6 flex items-center gap-3 text-left p-4 bg-white border border-[#f97316]/40 rounded-xl shadow-sm hover:bg-yellow-50 transition-colors animate-fade-in">
                                <span className="p-2 bg-[#f97316]/10 rounded-lg text-[#f97316]"><Icon name="bell" className="w-5 h-5" /></span>
                                <span className="min-w-0">
                                    <span className="block font-black text-[#1e1b4b] text-sm">{newActivities.length === 1 ? 'Nova atividade postada' : `${newActivities.length} novas atividades postadas`}</span>
                                    <span className="block text-xs text-stone-500 font-semibold truncate">{newActivities[0].title}{newActivities[0].subject ? ` • ${newActivities[0].subject}` : ''} — toque para ver</span>
                                </span>
                            </button>
                        )}
                        {renderView()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('edugestao_session')));
    const [data, setData] = useState({ classes: [], allStudents: [], activities: [], submissions: [], enrollments: [], grades: [], exams: [], attendance: [] });
    const [isReady, setIsReady] = useState(false);
    const [dbError, setDbError] = useState(null);

    useEffect(() => {
        if (!document.getElementById('edugestao-styles')) {
            const style = document.createElement('style');
            style.id = 'edugestao-styles';
            style.innerHTML = globalStyles;
            document.head.appendChild(style);
        }
    }, []);

    useEffect(() => {
        let unsubscribes = [];
        const initDb = async () => {
            try {
                await signInAnonymously(auth);
                const collectionsList = [
                    { key: 'classes', dbName: 'classes' }, { key: 'allStudents', dbName: 'students' },
                    { key: 'activities', dbName: 'activities' }, { key: 'submissions', dbName: 'submissions' },
                    { key: 'enrollments', dbName: 'enrollments' }, { key: 'grades', dbName: 'grades' },
                    { key: 'exams', dbName: 'exams' }, { key: 'attendance', dbName: 'attendance' }
                ];
                
                collectionsList.forEach(({key, dbName}) => {
                    const q = collection(db, getCollectionPath(dbName));
                    const unsub = onSnapshot(q, (snapshot) => {
                        setData(prev => ({ ...prev, [key]: snapshot.docs.map(doc => doc.data()) }));
                    }, (error) => {
                        console.error(`Error loading ${dbName}:`, error);
                        if (error.code === 'permission-denied') setDbError('permission-denied');
                    });
                    unsubscribes.push(unsub);
                });
                setIsReady(true);
            } catch (e) {
                console.error("Firebase auth/init error:", e);
                if (e.code === 'auth/operation-not-allowed') setDbError('auth-disabled');
            }
        };
        initDb();
        return () => unsubscribes.forEach(u => u());
    }, []);

    const login = (u) => { sessionStorage.setItem('edugestao_session', JSON.stringify(u)); setUser(u); };
    const logout = () => { sessionStorage.removeItem('edugestao_session'); window.location.hash = ''; setUser(null); };
    const refreshData = () => {}; 

    if (dbError === 'permission-denied') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#fefce8] p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200 max-w-2xl animate-fade-in">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Icon name="lock" className="w-8 h-8" /></div>
                    <h2 className="text-2xl font-black text-[#1e1b4b] mb-2">Banco de Dados Bloqueado</h2>
                    <p className="text-stone-600 mb-6 font-medium">O Firebase bloqueou o acesso. Para o sistema funcionar, atualize as <strong>Regras de Segurança</strong> do Firestore.</p>
                    <Button onClick={() => window.location.reload()} className="w-full shadow-md">Já atualizei, Recarregar Sistema</Button>
                </div>
            </div>
        );
    }

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fefce8]">
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="relative w-20 h-20 flex items-center justify-center"><div className="absolute inset-0 border-4 border-yellow-200 border-t-[#f97316] rounded-full animate-spin"></div><LogoEscola className="w-10 h-10" /></div>
                    <p className="text-[#1e1b4b] font-black tracking-widest uppercase text-sm">Conectando ao Banco de Dados...</p>
                </div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ user, login, logout, refreshData, ...data }}>
            {user ? <MainApp /> : <LoginScreen />}
        </AppContext.Provider>
    );
}
