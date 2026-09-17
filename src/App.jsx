import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';

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

const globalStyles = `
  * { box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 0; background-color: #fefce8; color: #1c1917; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #fde047; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #facc15; }
  @keyframes slideUpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .animate-fade-in { animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .grid-auto-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
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
        'eye': <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></>
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
        primary: "bg-[#1e1b4b] text-white hover:bg-[#312e81] shadow-sm border border-transparent disabled:opacity-50 disabled:cursor-not-allowed",
        secondary: "bg-white text-stone-800 hover:bg-stone-50 shadow-sm border border-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed",
        danger: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed",
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all outline-none focus:ring-2 focus:ring-[#1e1b4b] focus:ring-offset-2 ${variants[variant]} ${className}`}>
            {icon && <Icon name={icon} className="w-4 h-4" />}
            {children}
        </button>
    );
};

const Card = ({ children, title, action, className = '', noPadding = false }) => (
    <div className={`bg-white rounded-xl border border-yellow-200 flex flex-col shadow-sm ${className}`}>
        {(title || action) && (
            <div className="px-6 py-4 border-b border-yellow-100 flex items-center justify-between">
                <h3 className="font-bold text-[#1e1b4b] text-sm uppercase tracking-wide">{title}</h3>
                {action && <div>{action}</div>}
            </div>
        )}
        <div className={`flex-1 ${noPadding ? '' : 'p-6'}`}>{children}</div>
    </div>
);

const MetricCard = ({ title, value, icon, onClick }) => {
    return (
        <div onClick={onClick} className={`bg-white rounded-xl border border-yellow-200 p-6 flex flex-col gap-3 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-[#f97316] hover:-translate-y-1 hover:shadow-md' : ''}`}>
            <div className="flex justify-between items-center">
                <p className="text-sm font-bold uppercase tracking-wide text-stone-500">{title}</p>
                <div className="p-2 bg-yellow-50 rounded-lg text-[#f97316]">
                    <Icon name={icon} className="w-5 h-5" />
                </div>
            </div>
            <p className="text-4xl font-black text-[#1e1b4b] tracking-tight">{value}</p>
        </div>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-yellow-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                <div className="px-6 py-5 border-b border-yellow-100 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-bold text-[#1e1b4b]">{title}</h3>
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

const Input = ({ label, type = 'text', value, onChange, placeholder, required, icon }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-bold text-stone-700 mb-1.5">{label}</label>}
        <div className="relative">
            {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400"><Icon name={icon} className="w-5 h-5"/></div>}
            <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} 
                   className={`w-full ${icon ? 'pl-10' : 'px-4'} py-2.5 bg-white border border-yellow-200 rounded-lg text-sm text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#f97316] focus:border-[#f97316] outline-none transition-all shadow-sm`} />
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ${variants[variant]}`}>
            {children}
        </span>
    );
};

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
            if (student) login({ ...student, role: 'student' });
            else setError('Usuário ou senha incorretos.');
        }
    };

    return (
        <div className="min-h-screen flex bg-[#fefce8]">
            <div className="hidden lg:flex w-1/2 bg-[#1e1b4b] text-white p-12 flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#f97316] rounded-full blur-[120px] opacity-20 -mr-40 -mt-40 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#16a34a] rounded-full blur-[100px] opacity-20 -ml-20 -mb-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-xl">
                        <LogoEscola className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">E.E. Edson Alves Pereira</h1>
                    <p className="text-[#eab308] font-bold text-xl uppercase tracking-widest">Portal Acadêmico</p>
                </div>
                <p className="text-indigo-200 text-sm relative z-10 font-medium">Montezuma/MG • Sistema de Gestão Educacional</p>
            </div>
            
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-sm animate-fade-in">
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
    );
};

const ProfessorDashboard = ({ setCurrentView }) => {
    const { classes, allStudents, activities, submissions } = useContext(AppContext);
    return (
        <div className="space-y-8 animate-fade-in">
            <header className="mb-8">
                <h2 className="text-2xl font-black text-[#1e1b4b] tracking-tight">Visão Geral</h2>
                <p className="text-stone-500 text-sm font-medium mt-1">Resumo do seu ambiente educacional.</p>
            </header>
            
            <div className="grid-auto-cards">
                <MetricCard title="Turmas Ativas" value={classes.length} icon="book" onClick={() => setCurrentView('classes')} />
                <MetricCard title="Total de Alunos" value={allStudents.length} icon="users" onClick={() => setCurrentView('students')} />
                <MetricCard title="Atividades" value={activities.length} icon="file-text" onClick={() => setCurrentView('activities')} />
                <MetricCard title="Entregas" value={submissions.length} icon="download" onClick={() => setCurrentView('grading')} />
            </div>

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
                                        <Badge variant="orange">{act.value} pts</Badge>
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
    const { classes, refreshData, allStudents, enrollments } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [newClass, setNewClass] = useState({ id: null, name: '', description: '', subjects: '' });

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

    const handleDeleteClass = (id) => {
        dbService.delete('classes', id);
    };

    const handleImport = async (className, rawNames, defaultSubjects) => {
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
    };

    const toggleEnrollment = (studentId, isEnrolled, enrollmentId) => {
        if (isEnrolled) dbService.delete('enrollments', enrollmentId);
        else dbService.add('enrollments', { classId: selectedClass.id, studentId: studentId });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4">
                <div>
                    <h2 className="text-2xl font-black text-[#1e1b4b] tracking-tight">Gestão de Turmas</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleImport("3º EMTI 1", [], ["Laboratório de informática"])} variant="secondary" icon="download">Imp. 3º EMTI 1</Button>
                    <Button onClick={() => handleImport("3º EMTI 2", [], ["Laboratório de informática"])} variant="secondary" icon="download">Imp. 3º EMTI 2</Button>
                    <Button onClick={() => handleImport("2º Informática", ["ADELSON SIMÕES DA CRUZ", "ALAN DANIEL DOS SANTOS SOUZA", "ALLEF CORDEIRO DANTAS", "ANA LUCIA SANTOS DE OLIVEIRA", "ANA PAULA FRANCISCA SILVEIRA", "ANGEANE ANTUNES DOS SANTOS PEREIRA", "CARLA APARECIDA CARVALHO PARDIM", "CRISTINA ROSALINA DE OLIVEIRA ROCHA", "DARLIANE RIBEIRO SOARES", "DOUGLAS MANOEL MARQUES BORBOREMA", "ELIENE SOARES COSTA", "EVANICE DA CRUZ RIBEIRO", "FRANCIELI DOS SANTOS FERREIRA", "GABRIELLY VITÓRIA ALMEIDA SOUZA", "GRACIANA MENDES", "HERIK JEAN DA SILVA SIMÕES", "KACIELLY ANTUNES DE OLIVEIRA", "KAROLINE DE OLIVEIRA MATIAS", "KAUANE ARAUJO COSTA", "LEONÊIDE ALVES SILVEIRA", "MILTON JOSE DA SILVA", "NUBIA NUNES DA SILVA", "PAULA DIAS DE SOUZA", "POLIANNY ALVES ANTUNES MORAIS", "RADIMILA SOUZA DO NASCIMENTO", "VANDERSON RODRIGUES DE SOUZA"], ["Desenvolvimento WEB", "Manutenção de computadores"])} variant="secondary" icon="download">Imp. 2º Info</Button>
                    <Button onClick={() => handleImport("3º Informática", ["ALAN PRATES LIMA", "CARLEANE RITA NERES", "DEIVID BRIAN DOS SANTOS PEREIRA", "DIVANIELE MORAIS SANTOS COSTA", "EDILENE CORDEIRO DO NASCIMENTO OLIVEIRA", "JOSINEIDE BISPO COSTA", "KAYQUE DE OLIVEIRA SOBRINHO", "KENEDY IGOR TOMAZ PEREIRA", "LUANNA RODRIGUES DA ROCHA", "RAFAELA NERES DA SILVA SILVEIRA", "RAILENE MENDES DIAS", "ROSIMAR MARIA DE SOUSA", "SELMA DE SALES PEREIRA"], ["Análise de projetos de sistemas"])} variant="secondary" icon="download">Imp. 3º Info</Button>
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
                                <button type="button" onClick={() => handleDeleteClass(cls.id)} className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Excluir"><Icon name="trash" className="w-4 h-4"/></button>
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
                            <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => { setSelectedClass(cls); setIsManageModalOpen(true); }}>
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
                        <label className="block text-sm font-bold text-stone-700 mb-1.5">Descrição</label>
                        <textarea rows="2" value={newClass.description} onChange={e => setNewClass({...newClass, description: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f97316] focus:border-[#f97316] outline-none shadow-sm"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-stone-700 mb-1.5">Matérias (separadas por vírgula)</label>
                        <textarea rows="2" placeholder="Ex: Desenvolvimento Web, Manutenção de Computadores" value={newClass.subjects} onChange={e => setNewClass({...newClass, subjects: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f97316] focus:border-[#f97316] outline-none shadow-sm"></textarea>
                        <p className="text-xs text-stone-500 mt-1">Essas matérias estarão disponíveis ao criar atividades para esta turma.</p>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title={`Alunos: ${selectedClass?.name}`}>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {allStudents.map(student => {
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
        </div>
    );
};

const ProfessorStudents = () => {
    const { allStudents } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', username: '', password: '' });

    const handleSave = (e) => {
        e.preventDefault();
        if (formData.id) dbService.update('students', formData.id, formData);
        else dbService.add('students', formData);
        setIsModalOpen(false);
    };

    const handleDelete = (id) => {
        dbService.delete('students', id); 
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center pb-4">
                <h2 className="text-2xl font-black text-[#1e1b4b]">Base de Alunos</h2>
                <Button onClick={() => {setFormData({id:null, name:'', username:'', password:''}); setIsModalOpen(true);}} icon="plus">Cadastrar</Button>
            </div>

            <Card noPadding>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-yellow-200 bg-yellow-50/50">
                            <tr>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Nome Completo</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Usuário</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Senha Acesso</th>
                                <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-100">
                            {allStudents.map(s => (
                                <tr key={s.id} className="hover:bg-yellow-50/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-[#1e1b4b]">{s.name}</td>
                                    <td className="px-6 py-4 text-stone-500 font-mono text-xs">{s.username}</td>
                                    <td className="px-6 py-4"><span className="text-xs bg-stone-100 border border-stone-200 font-mono font-bold text-stone-600 px-2.5 py-1 rounded-md">{s.password}</span></td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => {setFormData(s); setIsModalOpen(true);}} className="text-stone-400 hover:text-[#f97316] p-2 rounded-lg hover:bg-orange-50 transition-colors"><Icon name="edit" className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete(s.id)} className="text-stone-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"><Icon name="trash" className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastro de Aluno">
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <Input label="Usuário de Acesso" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
                    <Input label="Senha Temporária" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                    <div className="flex justify-end gap-3 mt-6"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar Registro</Button></div>
                </form>
            </Modal>
        </div>
    );
};

const ProfessorActivities = () => {
    const { activities, classes } = useContext(AppContext);
    const [isFormView, setIsFormView] = useState(false);
    const [formData, setFormData] = useState({ id: null, title: '', classId: '', subject: '', dueDate: '', value: '', requiresSubmission: true });

    const selectedClassObj = classes.find(c => c.id === formData.classId);

    const handleSave = (e) => {
        e.preventDefault();
        if (formData.id) dbService.update('activities', formData.id, formData);
        else dbService.add('activities', formData);
        setIsFormView(false);
    };

    const handleDelete = (id) => dbService.delete('activities', id);

    if (isFormView) {
        return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4 pb-4 border-b border-yellow-200">
                    <button onClick={() => setIsFormView(false)} className="p-2 bg-white border border-yellow-200 rounded-lg text-stone-500 hover:text-[#1e1b4b] hover:bg-yellow-50 transition-colors"><Icon name="chevron-right" className="w-5 h-5 rotate-180"/></button>
                    <h2 className="text-2xl font-black text-[#1e1b4b]">{formData.id ? "Editar Avaliação" : "Nova Avaliação"}</h2>
                </div>

                <Card>
                    <form onSubmit={handleSave} className="space-y-5">
                        <Input label="Título da Avaliação" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                        
                        <div>
                            <label className="block text-sm font-bold text-stone-700 mb-1.5">Turma de Aplicação</label>
                            <select className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] outline-none shadow-sm" 
                                value={formData.classId} 
                                onChange={e => setFormData({...formData, classId: e.target.value, subject: ''})} required>
                                <option value="">Selecione a turma...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {selectedClassObj && selectedClassObj.subjects && selectedClassObj.subjects.length > 0 && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-bold text-stone-700 mb-1.5">Matéria</label>
                                <select className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] outline-none shadow-sm" 
                                    value={formData.subject} 
                                    onChange={e => setFormData({...formData, subject: e.target.value})} required>
                                    <option value="">Selecione a matéria...</option>
                                    {selectedClassObj.subjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Input type="date" label="Data de Aplicação/Entrega" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                            <Input type="number" label="Valor Máximo (pts)" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} required />
                        </div>
                        
                        <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-xl">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" checked={formData.requiresSubmission} onChange={e => setFormData({...formData, requiresSubmission: e.target.checked})} className="mt-1 w-5 h-5 text-[#16a34a] border-yellow-300 rounded focus:ring-[#16a34a]"/> 
                                <div>
                                    <span className="block text-sm font-bold text-[#1e1b4b]">Exige Envio Digital (Texto/Arquivo)</span>
                                    <span className="block text-xs font-medium text-stone-500 mt-1">Desmarque esta opção se for uma avaliação apenas presencial.</span>
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
            <div className="flex justify-between items-center pb-4">
                <h2 className="text-2xl font-black text-[#1e1b4b]">Avaliações</h2>
                <Button onClick={() => { setFormData({ id: null, title: '', classId: '', subject: '', dueDate: '', value: '', requiresSubmission: true }); setIsFormView(true); }} icon="plus">Publicar Nova</Button>
            </div>

            <div className="grid-auto-cards">
                {activities.slice().reverse().map(act => {
                    const cls = classes.find(c => c.id === act.classId);
                    return (
                        <Card key={act.id} className="hover:border-[#16a34a] border-t-4 border-t-[#16a34a]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-2">
                                    <Badge variant="emerald">{act.value} pts</Badge>
                                    {!act.requiresSubmission && <Badge variant="slate">Presencial</Badge>}
                                </div>
                                <div className="flex gap-1 -mt-2 -mr-2">
                                    <button type="button" onClick={() => { setFormData(act); setIsFormView(true); }} className="text-stone-400 hover:text-[#f97316] p-2 rounded-lg hover:bg-orange-50 transition-colors"><Icon name="edit" className="w-4 h-4"/></button>
                                    <button type="button" onClick={() => handleDelete(act.id)} className="text-stone-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"><Icon name="trash" className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <h3 className="font-black text-lg text-[#1e1b4b] leading-tight">{act.title}</h3>
                            <p className="text-sm font-bold text-stone-500 mt-1.5">{cls?.name}</p>
                            {act.subject && (
                                <div className="mt-2 flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-max">
                                    <Icon name="tag" className="w-3 h-3 mr-1" /> {act.subject}
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
        </div>
    );
};

const ProfessorGrading = () => {
    const { activities, classes, allStudents, enrollments, grades, submissions } = useContext(AppContext);
    const [selectedActivity, setSelectedActivity] = useState('');
    const [viewSubmission, setViewSubmission] = useState(null);

    const currentAct = activities.find(a => a.id === selectedActivity);
    const studentsInClass = useMemo(() => {
        if (!currentAct) return [];
        const classEnrolls = enrollments.filter(e => e.classId === currentAct.classId).map(e => e.studentId);
        return allStudents.filter(s => classEnrolls.includes(s.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [currentAct, enrollments, allStudents]);

    // Função que intercepta a nota e aplica limites
    const handleGrade = (studentId, rawValue, e) => {
        const existing = grades.find(g => g.activityId === currentAct.id && g.studentId === studentId);
        
        // Se apagar o valor da caixa (deixar vazio), removemos a nota do banco
        if (rawValue === '') {
            if (existing) dbService.delete('grades', existing.id);
            return;
        }

        let numValue = Number(rawValue);
        const maxVal = Number(currentAct.value);
        
        // Aplica os limites: Não menor que 0, não maior que o máximo da atividade
        if (numValue < 0) numValue = 0;
        if (numValue > maxVal) numValue = maxVal;
        
        // Atualiza a interface visualmente caso o professor tenha digitado um valor fora dos limites
        if (e) e.target.value = numValue;

        if (existing) {
            // Só salva se realmente for diferente para poupar requisições
            if (existing.grade !== numValue) dbService.update('grades', existing.id, { grade: numValue });
        } else {
            dbService.add('grades', { activityId: currentAct.id, studentId: studentId, classId: currentAct.classId, grade: numValue });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="pb-4 border-b border-yellow-200">
                <h2 className="text-2xl font-black text-[#1e1b4b]">Lançamento de Notas</h2>
            </div>
            
            <div className="max-w-xl">
                <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wide">Filtrar por Avaliação:</label>
                <select className="w-full px-4 py-3.5 bg-white border border-yellow-200 rounded-xl text-sm font-bold text-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] focus:border-[#1e1b4b] outline-none shadow-sm" value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}>
                    <option value="">-- Escolha uma avaliação na lista --</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.title} {a.subject ? `(${a.subject})` : ''} - {classes.find(c=>c.id===a.classId)?.name}</option>)}
                </select>
            </div>

            {currentAct && (
                <Card noPadding className="mt-4 border-t-4 border-t-[#1e1b4b]">
                    <div className="p-6 border-b border-yellow-100 bg-yellow-50/50">
                        <div className="flex gap-2 items-center mb-2">
                            <h3 className="font-black text-xl text-[#1e1b4b]">{currentAct.title}</h3>
                            {currentAct.subject && <Badge variant="indigo">{currentAct.subject}</Badge>}
                        </div>
                        <p className="text-sm font-bold text-stone-500 uppercase tracking-wide">Valor Máximo: {currentAct.value} pts</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="border-b border-yellow-200 bg-white">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Aluno</th>
                                    {currentAct.requiresSubmission !== false && (
                                        <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs">Resposta Enviada</th>
                                    )}
                                    <th className="px-6 py-4 font-bold text-stone-500 uppercase tracking-wider text-xs w-48 text-center">Nota Obtida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-yellow-100">
                                {studentsInClass.map(s => {
                                    const grade = grades.find(g => g.activityId === currentAct.id && g.studentId === s.id);
                                    const submission = submissions.find(sub => sub.activityId === currentAct.id && sub.studentId === s.id);
                                    
                                    return (
                                        <tr key={s.id} className="hover:bg-yellow-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-[#1e1b4b]">{s.name}</td>
                                            
                                            {currentAct.requiresSubmission !== false && (
                                                <td className="px-6 py-4">
                                                    {submission ? (
                                                        <Button variant="secondary" className="py-1 px-2.5 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" onClick={() => setViewSubmission({student: s, sub: submission})}>
                                                            <Icon name="eye" className="w-3 h-3 mr-1" /> Ver Resposta
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs font-bold text-stone-400">Pendente</span>
                                                    )}
                                                </td>
                                            )}

                                            <td className="px-6 py-4 text-center">
                                                <input type="number" 
                                                    min="0"
                                                    max={currentAct.value}
                                                    className="w-24 px-3 py-2 border border-yellow-300 rounded-lg text-center font-black text-lg text-[#1e1b4b] focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] outline-none shadow-sm bg-white" 
                                                    defaultValue={grade?.grade !== undefined ? grade.grade : ''} 
                                                    onBlur={e => handleGrade(s.id, e.target.value, e)} 
                                                    placeholder="-" 
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <Modal isOpen={!!viewSubmission} onClose={() => setViewSubmission(null)} title={`Resposta de ${viewSubmission?.student?.name}`}>
                {viewSubmission && (
                    <div className="space-y-4">
                        <div className="p-4 bg-white border border-yellow-200 rounded-xl">
                            <p className="text-xs font-bold text-stone-500 uppercase mb-2">Texto da Resposta:</p>
                            <p className="text-sm text-stone-800 whitespace-pre-wrap">{viewSubmission.sub.textResponse || 'Nenhum texto digitado.'}</p>
                        </div>
                        
                        {viewSubmission.sub.fileData && (
                            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Icon name="file-text" className="w-6 h-6 text-indigo-600 shrink-0"/>
                                    <span className="font-bold text-sm text-indigo-900 truncate">{viewSubmission.sub.fileName}</span>
                                </div>
                                <a href={viewSubmission.sub.fileData} download={viewSubmission.sub.fileName} className="shrink-0 ml-4 flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                                    <Icon name="download" className="w-4 h-4"/> Baixar
                                </a>
                            </div>
                        )}
                        <div className="pt-4 flex justify-end">
                            <Button onClick={() => setViewSubmission(null)}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const StudentDashboard = ({ setCurrentView }) => {
    const { user, enrollments, grades, activities } = useContext(AppContext);
    const myClassesIds = enrollments.filter(e => e.studentId === user.id).map(e => e.classId);
    
    return (
        <div className="space-y-8 animate-fade-in">
            <h2 className="text-3xl font-black text-[#1e1b4b] tracking-tight">Olá, {user.name.split(' ')[0]}</h2>
            <div className="grid-auto-cards">
                <MetricCard title="Minhas Turmas" value={myClassesIds.length} icon="book" />
                <MetricCard title="Tarefas" value={activities.filter(a => myClassesIds.includes(a.classId)).length} icon="file-text" onClick={() => setCurrentView('activities')} />
                <MetricCard title="Notas Lançadas" value={grades.filter(g=>g.studentId===user.id).length} icon="check-circle" onClick={() => setCurrentView('grades')} />
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
                <Button variant="secondary" onClick={() => setCurrentView('activities')} className="py-8 justify-start px-8 shadow-sm hover:border-[#f97316]"><Icon name="file-text" className="w-6 h-6 text-[#f97316] mr-3"/> <span className="font-black text-base">Ver Minhas Atividades</span></Button>
                <Button variant="secondary" onClick={() => setCurrentView('grades')} className="py-8 justify-start px-8 shadow-sm hover:border-[#16a34a]"><Icon name="check-circle" className="w-6 h-6 text-[#16a34a] mr-3"/> <span className="font-black text-base">Acessar Boletim Escolar</span></Button>
            </div>
        </div>
    );
};

const StudentActivities = () => {
    const { user, activities, classes, enrollments, submissions } = useContext(AppContext);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [textResponse, setTextResponse] = useState('');
    const [file, setFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [cancelTarget, setCancelTarget] = useState(null);

    const myClassesIds = enrollments.filter(e => e.studentId === user.id).map(e => e.classId);
    const available = activities.filter(a => myClassesIds.includes(a.classId));

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            // Verifica o tamanho do arquivo para salvar no Firestore (Máx 800KB para ser seguro)
            if (selected.size > 800 * 1024) {
                setErrorMsg("O arquivo é muito grande. Para esta versão, o limite é 800 KB.");
                e.target.value = '';
                setFile(null);
                return;
            }
            setErrorMsg('');
            setFile(selected);
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
            <h2 className="text-2xl font-black text-[#1e1b4b] pb-4">Quadro de Atividades</h2>
            <div className="grid grid-cols-1 gap-6">
                {available.slice().reverse().map(act => {
                    const mySubmission = submissions.find(s => s.activityId === act.id && s.studentId === user.id);

                    return (
                        <Card key={act.id} className="flex flex-col md:flex-row gap-0 p-0 border-l-4 border-l-[#eab308]">
                            <div className="flex-1 p-6">
                                <Badge variant="amber">Valor Máximo: {act.value} pts</Badge>
                                <h3 className="text-xl font-black text-[#1e1b4b] mt-3">{act.title}</h3>
                                <p className="text-sm font-bold text-stone-500 mt-1">{classes.find(c=>c.id===act.classId)?.name}</p>
                                {act.subject && (
                                    <div className="mt-2 flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-max">
                                        <Icon name="tag" className="w-3 h-3 mr-1" /> {act.subject}
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
                                                <p className="text-xs font-bold text-[#16a34a] uppercase">Enviado</p>
                                            </div>
                                            <Button variant="secondary" className="text-xs py-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={() => setCancelTarget(mySubmission.id)}>
                                                Desfazer Envio
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button className="w-full bg-[#f97316] hover:bg-orange-600 text-white" onClick={() => { setSelectedActivity(act); setErrorMsg(''); }}>Responder Agora</Button>
                                    )}
                                </div>
                            ) : (
                                <div className="md:w-64 bg-[#16a34a]/10 p-6 border-l border-[#16a34a]/20 flex flex-col justify-center items-center text-center shrink-0">
                                    <Icon name="check-circle" className="w-8 h-8 text-[#16a34a] mb-2"/>
                                    <p className="text-sm font-black text-[#1e1b4b] uppercase">Atividade Presencial</p>
                                    <p className="text-xs font-bold text-stone-600 mt-1">Aguarde o lançamento da nota</p>
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
                        <label className="block text-sm font-bold text-stone-700 mb-1.5">Sua Resposta (Texto)</label>
                        <textarea 
                            rows="4" 
                            value={textResponse} 
                            onChange={e => setTextResponse(e.target.value)} 
                            placeholder="Digite sua resposta aqui se não for enviar um arquivo..."
                            className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f97316] outline-none shadow-sm"
                        ></textarea>
                    </div>

                    <div className="p-4 border border-yellow-200 bg-white rounded-xl shadow-sm">
                        <label className="block text-sm font-bold text-stone-700 mb-3">Anexar Arquivo</label>
                        
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex gap-3 items-start">
                            <Icon name="tag" className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">Atenção: Limite Máximo de 800 KB</p>
                                <p className="text-xs font-medium text-orange-700 leading-relaxed">
                                    O sistema utiliza armazenamento otimizado. Por favor, envie documentos leves. Se for uma foto do caderno, reduza a qualidade da câmera. Se for um PDF pesado, utilize um site para comprimir antes de enviar.
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
    
    const myGrades = grades.filter(g => g.studentId === user.id).map(g => ({
        grade: g, act: activities.find(a => a.id === g.activityId) || {}, cls: classes.find(c => c.id === g.classId) || {}
    }));

    const groupedGrades = myGrades.reduce((acc, current) => {
        const subject = current.act.subject || 'Geral/Sem Matéria';
        if (!acc[subject]) acc[subject] = { totalObtido: 0, totalPossivel: 0, items: [] };
        acc[subject].items.push(current);
        acc[subject].totalObtido += Number(current.grade.grade || 0);
        acc[subject].totalPossivel += Number(current.act.value || 0);
        return acc;
    }, {});

    let globalObtido = myGrades.reduce((a, c) => a + Number(c.grade.grade || 0), 0);
    let globalPossivel = myGrades.reduce((a, c) => a + Number(c.act.value || 0), 0);
    const globalPercent = globalPossivel > 0 ? ((globalObtido/globalPossivel)*100).toFixed(1) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-black text-[#1e1b4b] pb-2">Meu Boletim Escolar</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#1e1b4b] rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[50px] opacity-10 -mr-10 -mt-10"></div>
                    <p className="text-indigo-200 text-sm font-bold uppercase tracking-wider">Aproveitamento Global</p>
                    <p className="text-6xl font-black mt-3 tracking-tight">{globalPercent}%</p>
                </div>
                <div className="bg-white rounded-xl p-8 border border-yellow-200 shadow-sm flex flex-col justify-center">
                    <p className="text-stone-500 text-sm font-bold uppercase tracking-wider">Pontos Globais</p>
                    <p className="text-5xl font-black text-[#16a34a] mt-3 tracking-tight">{globalObtido} <span className="text-xl font-bold text-stone-400 lowercase">pts</span></p>
                </div>
                <div className="bg-white rounded-xl p-8 border border-yellow-200 shadow-sm flex flex-col justify-center">
                    <p className="text-stone-500 text-sm font-bold uppercase tracking-wider">Total Distribuído</p>
                    <p className="text-5xl font-black text-[#1e1b4b] mt-3 tracking-tight">{globalPossivel} <span className="text-xl font-bold text-stone-400 lowercase">pts</span></p>
                </div>
            </div>

            {Object.entries(groupedGrades).map(([subject, data], idx) => {
                const percentSubject = data.totalPossivel > 0 ? ((data.totalObtido / data.totalPossivel) * 100).toFixed(1) : 0;
                
                return (
                    <div key={idx} className="mb-8">
                        <div className="flex items-center justify-between bg-[#f97316] text-white px-6 py-4 rounded-t-xl">
                            <h3 className="font-black text-lg uppercase tracking-wide flex items-center gap-2">
                                <Icon name="book" className="w-5 h-5"/> {subject}
                            </h3>
                            <div className="text-right">
                                <span className="text-sm font-bold opacity-80 block uppercase tracking-wider text-[10px]">Aproveitamento: {percentSubject}%</span>
                                <span className="font-black text-xl">{data.totalObtido} / {data.totalPossivel} pts</span>
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
                    Nenhuma nota lançada ainda.
                </div>
            )}
        </div>
    );
};

const MainApp = () => {
    const { user, logout } = useContext(AppContext);
    const [currentView, setCurrentView] = useState(() => {
        const hash = window.location.hash.replace('#', '');
        return hash || 'dashboard';
    });
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isProf = user.role === 'professor';

    const menu = isProf ? 
        [{ id: 'dashboard', label: 'Painel Geral', icon: 'home' }, { id: 'classes', label: 'Turmas', icon: 'book' }, { id: 'students', label: 'Alunos', icon: 'users' }, { id: 'activities', label: 'Atividades', icon: 'file-text' }, { id: 'grading', label: 'Lançar Notas', icon: 'check-circle' }] 
        : [{ id: 'dashboard', label: 'Meu Painel', icon: 'home' }, { id: 'activities', label: 'Atividades', icon: 'file-text' }, { id: 'grades', label: 'Boletim Escolar', icon: 'check-circle' }];

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
            if (currentView === 'activities') return <ProfessorActivities />;
            if (currentView === 'grading') return <ProfessorGrading />;
            return <ProfessorDashboard setCurrentView={handleNavigate} />;
        } else {
            if (currentView === 'activities') return <StudentActivities />;
            if (currentView === 'grades') return <StudentGrades />;
            return <StudentDashboard setCurrentView={handleNavigate} />;
        }
    };

    const SidebarContent = () => (
        <>
            <div className="h-16 border-b border-yellow-200 flex items-center px-6 shrink-0 justify-between bg-white shadow-sm z-10">
                <div className="flex items-center gap-2.5">
                    <LogoEscola className="w-8 h-8" />
                    <div><span className="block font-black text-sm tracking-tight text-[#1e1b4b] uppercase leading-tight">E.E. Edson<br/>A. Pereira</span></div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-stone-400 hover:text-[#1e1b4b] p-1 bg-stone-50 rounded">
                    <Icon name="x" className="w-5 h-5"/>
                </button>
            </div>
            
            <div className="px-6 py-5 border-b border-yellow-100 bg-white">
                <p className="font-black text-[#1e1b4b] text-sm truncate">{user.name}</p>
                <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mt-1">{user.role}</p>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1 bg-white">
                {menu.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button key={item.id} onClick={() => handleNavigate(item.id)} 
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all
                            ${isActive ? 'bg-[#f97316]/10 text-[#f97316]' : 'text-stone-500 hover:bg-stone-50 hover:text-[#1e1b4b]'}`}>
                            <Icon name={item.icon} className={`w-5 h-5 ${isActive ? 'text-[#f97316]' : 'text-stone-400'}`} />
                            {item.label}
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
                <header className="h-16 flex-shrink-0 bg-white border-b border-yellow-200 flex items-center px-4 lg:px-10 justify-between z-10 lg:hidden shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="p-1.5 -ml-1.5 text-stone-500 hover:text-[#1e1b4b] hover:bg-yellow-50 rounded-md transition-colors border border-transparent hover:border-yellow-200">
                            <Icon name="menu" className="w-5 h-5" />
                        </button>
                        <h1 className="font-bold text-stone-800 text-sm tracking-wide uppercase">
                            {menu.find(m => m.id === currentView)?.label}
                        </h1>
                    </div>
                </header>
                
                <main className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
                    <div className="max-w-5xl mx-auto pb-12">{renderView()}</div>
                </main>
            </div>
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('edugestao_session')));
    const [data, setData] = useState({ classes: [], allStudents: [], activities: [], submissions: [], enrollments: [], grades: [] });
    const [isReady, setIsReady] = useState(false);
    const [dbError, setDbError] = useState(null);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = globalStyles;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        let unsubscribes = [];
        const initDb = async () => {
            try {
                await signInAnonymously(auth);
                const collectionsList = [
                    { key: 'classes', dbName: 'classes' }, { key: 'allStudents', dbName: 'students' },
                    { key: 'activities', dbName: 'activities' }, { key: 'submissions', dbName: 'submissions' },
                    { key: 'enrollments', dbName: 'enrollments' }, { key: 'grades', dbName: 'grades' }
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
                    <div className="w-16 h-16 border-4 border-yellow-200 border-t-[#f97316] rounded-full animate-spin"></div>
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
