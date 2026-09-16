import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';

const globalStyles = `
  * { box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  body { margin: 0; padding: 0; background-color: #fefce8; color: #1c1917; }
  
  /* Scrollbar Minimalista */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #fde047; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #facc15; }
  
  /* Animações */
  @keyframes slideUpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .animate-fade-in { animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  
  /* Grid Auto-Ajustável */
  .grid-auto-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }
`;

const AppContext = createContext();

const dbService = {
    get: (collection) => {
        try { return JSON.parse(localStorage.getItem(`edugestao_${collection}`)) || []; } 
        catch { return []; }
    },
    set: (collection, data) => localStorage.setItem(`edugestao_${collection}`, JSON.stringify(data)),
    add: (collection, item) => {
        const data = dbService.get(collection);
        const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), createdAt: Date.now() };
        dbService.set(collection, [...data, newItem]);
        return newItem;
    },
    update: (collection, id, updatedFields) => {
        const data = dbService.get(collection);
        const updatedData = data.map(item => item.id === id ? { ...item, ...updatedFields } : item);
        dbService.set(collection, updatedData);
    },
    delete: (collection, id) => {
        const data = dbService.get(collection);
        dbService.set(collection, data.filter(item => item.id !== id));
    }
};

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
        'menu': <><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></>
    };
    return (
        <svg onClick={onClick} className={`${className} ${onClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {icons[name] || icons['user']}
        </svg>
    );
};

// Ícone Customizado: Brasão Vetorial
const LogoEscola = ({ className = "w-8 h-8" }) => (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="30" r="14" fill="#f97316" />
        <path d="M50 48 Q 30 60 25 80 Q 40 75 50 55 Z" fill="#eab308" />
        <path d="M50 48 Q 70 60 75 80 Q 60 75 50 55 Z" fill="#16a34a" />
        <path d="M15 85 Q 50 95 85 85 Q 50 100 15 85 Z" fill="#1e1b4b" />
        <path d="M15 82 Q 50 92 85 82 Q 50 97 15 82 Z" fill="#312e81" />
    </svg>
);

const Button = ({ children, variant = 'primary', icon, onClick, className = '', type = 'button' }) => {
    const variants = {
        primary: "bg-[#1e1b4b] text-white hover:bg-[#312e81] shadow-sm border border-transparent",
        secondary: "bg-white text-stone-800 hover:bg-stone-50 shadow-sm border border-yellow-200",
        danger: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200",
    };
    return (
        <button type={type} onClick={onClick} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all outline-none focus:ring-2 focus:ring-[#1e1b4b] focus:ring-offset-2 ${variants[variant]} ${className}`}>
            {icon && <Icon name={icon} className="w-4 h-4" />}
            {children}
        </button>
    );
};

const Card = ({ children, title, action, className = '', noPadding = false }) => (
    <div className={`bg-white rounded-2xl border border-yellow-200 flex flex-col shadow-sm ${className}`}>
        {(title || action) && (
            <div className="px-6 py-5 border-b border-yellow-100 flex items-center justify-between">
                <h3 className="font-bold text-[#1e1b4b] text-sm uppercase tracking-wide">{title}</h3>
                {action && <div>{action}</div>}
            </div>
        )}
        <div className={`flex-1 ${noPadding ? '' : 'p-6'}`}>{children}</div>
    </div>
);

const MetricCard = ({ title, value, icon }) => {
    return (
        <div className="bg-white rounded-2xl border border-yellow-200 p-6 flex flex-col gap-3 shadow-sm hover:border-[#f97316] transition-colors group">
            <div className="flex justify-between items-center">
                <p className="text-sm font-bold uppercase tracking-wide text-stone-500 group-hover:text-[#f97316] transition-colors">{title}</p>
                <div className="p-2.5 bg-yellow-50 rounded-xl text-[#f97316] group-hover:bg-[#f97316] group-hover:text-white transition-colors">
                    <Icon name={icon} className="w-5 h-5" />
                </div>
            </div>
            <p className="text-5xl font-black text-[#1e1b4b] tracking-tight">{value}</p>
        </div>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-yellow-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                <div className="px-8 py-6 border-b border-yellow-100 flex justify-between items-center bg-white">
                    <h3 className="text-xl font-black text-[#1e1b4b]">{title}</h3>
                    <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors p-1.5 bg-stone-50 rounded-xl hover:bg-stone-100">
                        <Icon name="x" className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-8 overflow-y-auto bg-stone-50/30 flex-1">{children}</div>
            </div>
        </div>
    );
};

const Input = ({ label, type = 'text', value, onChange, placeholder, required, icon }) => (
    <div className="mb-4">
        {label && <label className="block text-sm font-bold text-stone-700 mb-1.5">{label}</label>}
        <div className="relative">
            {icon && <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400"><Icon name={icon} className="w-5 h-5"/></div>}
            <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} 
                   className={`w-full ${icon ? 'pl-11' : 'px-4'} py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium text-stone-900 focus:bg-white focus:ring-2 focus:ring-[#f97316] focus:border-[#f97316] outline-none transition-all shadow-sm`} />
        </div>
    </div>
);

const Badge = ({ children, variant = 'slate' }) => {
    const variants = {
        indigo: "bg-[#1e1b4b]/10 text-[#1e1b4b] border-[#1e1b4b]/20",
        emerald: "bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20",
        amber: "bg-[#eab308]/10 text-[#ca8a04] border-[#eab308]/30",
        orange: "bg-gradient-to-r from-[#f97316] to-[#eab308] text-white border-transparent shadow-sm",
        slate: "bg-stone-100 text-stone-600 border-stone-200",
    };
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${variants[variant]}`}>
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
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-xl">
                        <LogoEscola className="w-12 h-12" />
                    </div>
                    <h1 className="text-5xl font-black tracking-tight mb-2">E.E. Edson Alves Pereira</h1>
                    <p className="text-[#eab308] font-bold text-2xl uppercase tracking-widest mt-4">Portal Acadêmico</p>
                </div>
                <p className="text-indigo-200 text-sm relative z-10 font-medium">Montezuma/MG • Sistema de Gestão Educacional</p>
            </div>
            
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md animate-fade-in">
                    <div className="lg:hidden flex flex-col items-center mb-10">
                        <div className="w-20 h-20 bg-white shadow-xl border border-yellow-100 rounded-3xl flex items-center justify-center mb-6">
                            <LogoEscola className="w-12 h-12" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-[#1e1b4b] text-center">E.E. Edson A. Pereira</h1>
                    </div>
                    
                    <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-xl border border-yellow-100">
                        <h2 className="text-3xl font-black text-[#1e1b4b] mb-2">Acesso restrito</h2>
                        <p className="text-sm text-stone-500 mb-8 font-medium">Insira suas credenciais para continuar.</p>

                        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl font-bold flex items-center gap-2"><Icon name="x" className="w-4 h-4"/>{error}</div>}
                        
                        <form onSubmit={handleLogin} className="space-y-5">
                            <Input label="Usuário de Acesso" icon="user" value={username} onChange={(e) => setUsername(e.target.value)} required />
                            <Input label="Senha" type="password" icon="lock" value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <Button type="submit" className="w-full py-4 mt-6 text-base rounded-xl shadow-lg shadow-[#1e1b4b]/20">Entrar no Sistema</Button>
                        </form>
                    </div>
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
                <h2 className="text-3xl font-black text-[#1e1b4b] tracking-tight">Visão Geral</h2>
                <p className="text-stone-500 text-base font-medium mt-2">Resumo do seu ambiente educacional.</p>
            </header>
            
            <div className="grid-auto-cards">
                <MetricCard title="Turmas Ativas" value={classes.length} icon="book" />
                <MetricCard title="Total de Alunos" value={allStudents.length} icon="users" />
                <MetricCard title="Atividades" value={activities.length} icon="file-text" />
                <MetricCard title="Entregas" value={submissions.length} icon="download" />
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                <Card title="Acesso Rápido" noPadding>
                    <div className="flex flex-col divide-y divide-yellow-100">
                        <button onClick={() => setCurrentView('classes')} className="flex items-center justify-between p-6 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-3 bg-stone-50 rounded-xl group-hover:bg-[#f97316]/10 transition-colors shadow-sm border border-stone-100 group-hover:border-[#f97316]/20"><Icon name="book" className="w-5 h-5 text-stone-400 group-hover:text-[#f97316]" /></div><span className="font-black text-base text-stone-700 group-hover:text-[#1e1b4b]">Gerenciar Turmas</span></div>
                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all"><Icon name="chevron-right" className="w-4 h-4 text-stone-300 group-hover:text-[#f97316]" /></div>
                        </button>
                        <button onClick={() => setCurrentView('students')} className="flex items-center justify-between p-6 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-3 bg-stone-50 rounded-xl group-hover:bg-[#16a34a]/10 transition-colors shadow-sm border border-stone-100 group-hover:border-[#16a34a]/20"><Icon name="users" className="w-5 h-5 text-stone-400 group-hover:text-[#16a34a]" /></div><span className="font-black text-base text-stone-700 group-hover:text-[#1e1b4b]">Lista de Alunos</span></div>
                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all"><Icon name="chevron-right" className="w-4 h-4 text-stone-300 group-hover:text-[#16a34a]" /></div>
                        </button>
                        <button onClick={() => setCurrentView('activities')} className="flex items-center justify-between p-6 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-3 bg-stone-50 rounded-xl group-hover:bg-[#eab308]/10 transition-colors shadow-sm border border-stone-100 group-hover:border-[#eab308]/20"><Icon name="plus" className="w-5 h-5 text-stone-400 group-hover:text-[#eab308]" /></div><span className="font-black text-base text-stone-700 group-hover:text-[#1e1b4b]">Nova Atividade</span></div>
                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all"><Icon name="chevron-right" className="w-4 h-4 text-stone-300 group-hover:text-[#eab308]" /></div>
                        </button>
                        <button onClick={() => setCurrentView('grading')} className="flex items-center justify-between p-6 hover:bg-yellow-50 transition-colors text-left group">
                            <div className="flex items-center gap-4"><div className="p-3 bg-stone-50 rounded-xl group-hover:bg-indigo-100 transition-colors shadow-sm border border-stone-100 group-hover:border-indigo-200"><Icon name="check-circle" className="w-5 h-5 text-stone-400 group-hover:text-[#1e1b4b]" /></div><span className="font-black text-base text-stone-700 group-hover:text-[#1e1b4b]">Lançar Notas</span></div>
                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all"><Icon name="chevron-right" className="w-4 h-4 text-stone-300 group-hover:text-[#1e1b4b]" /></div>
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
                                    <div key={act.id} className="p-6 hover:bg-yellow-50 transition-colors flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-[#1e1b4b] text-base">{act.title}</p>
                                            <p className="text-xs text-stone-500 mt-1 font-bold">{cls?.name || 'Turma Excluída'}</p>
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
    const [newClass, setNewClass] = useState({ name: '', description: '' });

    const handleCreateClass = (e) => {
        e.preventDefault();
        dbService.add('classes', { ...newClass, professorId: 'prof-gabriell', professorName: 'Prof. Gabriell' });
        setIsModalOpen(false);
        setNewClass({ name: '', description: '' });
        refreshData();
    };

    const handleImport = (className, rawNames) => {
        let cls = classes.find(c => c.name === className);
        if (!cls) cls = dbService.add('classes', { name: className, description: 'Importado via SIMADE', professorId: 'prof-gabriell', professorName: 'Prof. Gabriell' });
        
        const existingUsers = dbService.get('students');
        let currentEnrollments = dbService.get('enrollments');
        const nameTracker = new Set(existingUsers.map(s => s.username));

        rawNames.forEach(fullName => {
            const parts = fullName.split(' ');
            let baseUser = parts[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (nameTracker.has(baseUser)) baseUser = `${baseUser}.${parts[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
            nameTracker.add(baseUser);

            let student = existingUsers.find(s => s.name === fullName);
            if (!student) {
                student = { name: fullName, username: baseUser, password: baseUser, id: Math.random().toString(36).substr(2, 9) };
                existingUsers.push(student);
                dbService.set('students', existingUsers);
            }

            if (!currentEnrollments.some(e => e.classId === cls.id && e.studentId === student.id)) {
                currentEnrollments.push({ id: Math.random().toString(36).substr(2, 9), classId: cls.id, studentId: student.id });
                dbService.set('enrollments', currentEnrollments);
            }
        });
        refreshData();
    };

    const toggleEnrollment = (studentId, isEnrolled, enrollmentId) => {
        if (isEnrolled) dbService.delete('enrollments', enrollmentId);
        else dbService.add('enrollments', { classId: selectedClass.id, studentId: studentId });
        refreshData();
    };

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4">
                    <div>
                        <h2 className="text-2xl font-black text-[#1e1b4b] tracking-tight">Gestão de Turmas</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => handleImport("2º INFORMÁTICA EP PRO 1", ["ADELSON SIMÕES DA CRUZ", "ALAN DANIEL DOS SANTOS SOUZA", "ALLEF CORDEIRO DANTAS", "ANA LUCIA SANTOS DE OLIVEIRA", "ANA PAULA FRANCISCA SILVEIRA", "ANGEANE ANTUNES DOS SANTOS PEREIRA", "CARLA APARECIDA CARVALHO PARDIM", "CRISTINA ROSALINA DE OLIVEIRA ROCHA", "DARLIANE RIBEIRO SOARES", "DOUGLAS MANOEL MARQUES BORBOREMA", "ELIENE SOARES COSTA", "EVANICE DA CRUZ RIBEIRO", "FRANCIELI DOS SANTOS FERREIRA", "GABRIELLY VITÓRIA ALMEIDA SOUZA", "GRACIANA MENDES", "HERIK JEAN DA SILVA SIMÕES", "KACIELLY ANTUNES DE OLIVEIRA", "KAROLINE DE OLIVEIRA MATIAS", "KAUANE ARAUJO COSTA", "LEONÊIDE ALVES SILVEIRA", "MILTON JOSE DA SILVA", "NUBIA NUNES DA SILVA", "PAULA DIAS DE SOUZA", "POLIANNY ALVES ANTUNES MORAIS", "RADIMILA SOUZA DO NASCIMENTO", "VANDERSON RODRIGUES DE SOUZA"])} variant="secondary" icon="download">Imp. 2º Info</Button>
                        <Button onClick={() => handleImport("3º INFORMÁTICA EP PRO 1", ["ALAN PRATES LIMA", "CARLEANE RITA NERES", "DEIVID BRIAN DOS SANTOS PEREIRA", "DIVANIELE MORAIS SANTOS COSTA", "EDILENE CORDEIRO DO NASCIMENTO OLIVEIRA", "JOSINEIDE BISPO COSTA", "KAYQUE DE OLIVEIRA SOBRINHO", "KENEDY IGOR TOMAZ PEREIRA", "LUANNA RODRIGUES DA ROCHA", "RAFAELA NERES DA SILVA SILVEIRA", "RAILENE MENDES DIAS", "ROSIMAR MARIA DE SOUSA", "SELMA DE SALES PEREIRA"])} variant="secondary" icon="download">Imp. 3º Info</Button>
                        <Button onClick={() => setIsModalOpen(true)} icon="plus">Criar Turma</Button>
                    </div>
                </div>

                <div className="grid-auto-cards">
                    {classes.map(cls => (
                        <Card key={cls.id} className="hover:border-[#f97316] transition-colors border-t-4 border-t-[#f97316]">
                            <div className="mb-4">
                                <h3 className="font-black text-lg text-[#1e1b4b] leading-tight">{cls.name}</h3>
                                <p className="text-sm text-stone-500 mt-1.5 line-clamp-2 font-medium">{cls.description || 'Sem descrição.'}</p>
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-yellow-100">
                                <Badge variant="slate">{enrollments.filter(e => e.classId === cls.id).length} alunos</Badge>
                                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => { setSelectedClass(cls); setIsManageModalOpen(true); }}>
                                    Matrículas
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Turma">
                <form onSubmit={handleCreateClass} className="space-y-4">
                    <Input label="Nome da Turma" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} required />
                    <div>
                        <label className="block text-sm font-bold text-stone-700 mb-1.5">Descrição</label>
                        <textarea rows="3" value={newClass.description} onChange={e => setNewClass({...newClass, description: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-yellow-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f97316] focus:border-[#f97316] outline-none shadow-sm"></textarea>
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
        </>
    );
};

const ProfessorStudents = () => {
    const { allStudents, refreshData } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', username: '', password: '' });

    const handleSave = (e) => {
        e.preventDefault();
        if (formData.id) dbService.update('students', formData.id, formData);
        else dbService.add('students', formData);
        setIsModalOpen(false);
        refreshData();
    };

    const handleDelete = (id) => {
        dbService.delete('students', id); 
        refreshData(); 
    };

    return (
        <>
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
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastro de Aluno">
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <Input label="Usuário de Acesso" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
                    <Input label="Senha Temporária" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                    <div className="flex justify-end gap-3 mt-6"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar Registro</Button></div>
                </form>
            </Modal>
        </>
    );
};

const ProfessorActivities = () => {
    const { activities, classes, refreshData } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, title: '', classId: '', dueDate: '', value: '', requiresSubmission: true });

    const handleSave = (e) => {
        e.preventDefault();
        if (formData.id) {
            dbService.update('activities', formData.id, formData);
        } else {
            dbService.add('activities', formData);
        }
        setIsModalOpen(false);
        refreshData();
    };

    const handleDelete = (id) => {
        dbService.delete('activities', id);
        refreshData();
    };

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center pb-4">
                    <h2 className="text-3xl font-black text-[#1e1b4b]">Avaliações</h2>
                    <Button onClick={() => { setFormData({ id: null, title: '', classId: '', dueDate: '', value: '', requiresSubmission: true }); setIsModalOpen(true); }} icon="plus">Publicar Nova</Button>
                </div>

                <div className="grid-auto-cards">
                    {activities.slice().reverse().map(act => {
                        const cls = classes.find(c => c.id === act.classId);
                        return (
                            <Card key={act.id} className="hover:border-[#16a34a] border-t-4 border-t-[#16a34a]">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex gap-2">
                                        <Badge variant="emerald">{act.value} pts</Badge>
                                        {!act.requiresSubmission && <Badge variant="slate">Presencial</Badge>}
                                    </div>
                                    <div className="flex gap-1 -mt-2 -mr-2">
                                        <button type="button" onClick={() => { setFormData(act); setIsModalOpen(true); }} className="text-stone-400 hover:text-[#f97316] p-2 rounded-xl hover:bg-orange-50 transition-colors" title="Editar"><Icon name="edit" className="w-4 h-4"/></button>
                                        <button type="button" onClick={() => handleDelete(act.id)} className="text-stone-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors" title="Excluir"><Icon name="trash" className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <h3 className="font-black text-xl text-[#1e1b4b] leading-tight">{act.title}</h3>
                                <p className="text-sm font-bold text-stone-500 mt-2">{cls?.name}</p>
                                <div className="mt-6 pt-5 flex items-center text-xs font-black uppercase tracking-wider text-stone-400 gap-2 border-t border-yellow-100">
                                    <Icon name="clock" className="w-4 h-4" /> 
                                    {act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : 'Sem prazo limite'}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? "Editar Avaliação" : "Publicar Avaliação"}>
                <form onSubmit={handleSave} className="space-y-5">
                    <Input label="Título da Avaliação" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                    <div>
                        <label className="block text-sm font-bold text-stone-700 mb-1.5">Turma de Aplicação</label>
                        <select className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#16a34a] focus:border-[#16a34a] outline-none shadow-sm" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} required>
                            <option value="">Selecione a turma...</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input type="date" label="Data de Aplicação/Entrega" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                        <Input type="number" label="Valor Máximo (pts)" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} required />
                    </div>
                    <div className="mt-2 p-6 bg-yellow-50 border border-yellow-200 rounded-2xl">
                        <label className="flex items-start gap-4 cursor-pointer">
                            <input type="checkbox" checked={formData.requiresSubmission} onChange={e => setFormData({...formData, requiresSubmission: e.target.checked})} className="mt-1 w-5 h-5 text-[#16a34a] border-yellow-300 rounded focus:ring-[#16a34a]"/> 
                            <div>
                                <span className="block text-sm font-black text-[#1e1b4b]">Exige Envio Digital</span>
                                <span className="block text-xs font-medium text-stone-500 mt-1">Desmarque esta opção se for uma prova presencial impressa.</span>
                            </div>
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-yellow-100">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">{formData.id ? "Salvar Alterações" : "Publicar Atividade"}</Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

const ProfessorGrading = () => {
    const { activities, classes, allStudents, enrollments, grades, refreshData } = useContext(AppContext);
    const [selectedActivity, setSelectedActivity] = useState('');

    const currentAct = activities.find(a => a.id === selectedActivity);
    const studentsInClass = useMemo(() => {
        if (!currentAct) return [];
        const classEnrolls = enrollments.filter(e => e.classId === currentAct.classId).map(e => e.studentId);
        return allStudents.filter(s => classEnrolls.includes(s.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [currentAct, enrollments, allStudents]);

    const handleGrade = (studentId, gradeValue) => {
        const existing = grades.find(g => g.activityId === currentAct.id && g.studentId === studentId);
        if (existing) dbService.update('grades', existing.id, { grade: gradeValue });
        else dbService.add('grades', { activityId: currentAct.id, studentId: studentId, classId: currentAct.classId, grade: gradeValue });
        refreshData();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="pb-4 border-b border-yellow-200">
                <h2 className="text-3xl font-black text-[#1e1b4b]">Lançamento de Notas</h2>
            </div>
            
            <div className="max-w-xl">
                <label className="block text-sm font-black text-stone-700 mb-2 uppercase tracking-wide">Filtrar por Avaliação:</label>
                <select className="w-full px-4 py-4 bg-white border border-yellow-200 rounded-xl text-sm font-bold text-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] focus:border-[#1e1b4b] outline-none shadow-sm" value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)}>
                    <option value="">-- Escolha uma avaliação na lista --</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.title} - {classes.find(c=>c.id===a.classId)?.name}</option>)}
                </select>
            </div>

            {currentAct && (
                <Card noPadding className="mt-6 border-t-4 border-t-[#1e1b4b] rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-8 border-b border-yellow-100 bg-yellow-50/50">
                        <h3 className="font-black text-2xl text-[#1e1b4b]">{currentAct.title}</h3>
                        <p className="text-sm font-black text-stone-500 mt-2 uppercase tracking-widest">Valor Máximo: {currentAct.value} pts</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="border-b border-yellow-200 bg-white">
                                <tr>
                                    <th className="px-8 py-5 font-black text-stone-500 uppercase tracking-widest text-xs">Aluno</th>
                                    <th className="px-8 py-5 font-black text-stone-500 uppercase tracking-widest text-xs w-48 text-center">Nota Obtida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-yellow-100">
                                {studentsInClass.map(s => {
                                    const grade = grades.find(g => g.activityId === currentAct.id && g.studentId === s.id);
                                    return (
                                        <tr key={s.id} className="hover:bg-yellow-50/50 transition-colors">
                                            <td className="px-8 py-5 font-black text-[#1e1b4b] text-base">{s.name}</td>
                                            <td className="px-8 py-5 text-center">
                                                <input type="number" 
                                                    className="w-28 px-4 py-3 border border-yellow-300 rounded-xl text-center font-black text-xl text-[#1e1b4b] focus:border-[#1e1b4b] focus:ring-2 focus:ring-[#1e1b4b] outline-none shadow-sm bg-white" 
                                                    defaultValue={grade?.grade||''} 
                                                    onBlur={e => handleGrade(s.id, e.target.value)} 
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
        </div>
    );
};

const StudentDashboard = ({ setCurrentView }) => {
    const { user, enrollments, grades, activities } = useContext(AppContext);
    const myClassesIds = enrollments.filter(e => e.studentId === user.id).map(e => e.classId);
    
    return (
        <div className="space-y-8 animate-fade-in">
            <h2 className="text-4xl font-black text-[#1e1b4b] tracking-tight">Olá, {user.name.split(' ')[0]}</h2>
            <div className="grid-auto-cards">
                <MetricCard title="Minhas Turmas" value={myClassesIds.length} icon="book" />
                <MetricCard title="Tarefas" value={activities.filter(a => myClassesIds.includes(a.classId)).length} icon="file-text" />
                <MetricCard title="Notas Lançadas" value={grades.filter(g=>g.studentId===user.id).length} icon="check-circle" />
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
                <Button variant="secondary" onClick={() => setCurrentView('activities')} className="py-8 justify-start px-8 shadow-sm hover:border-[#f97316] group"><Icon name="file-text" className="w-6 h-6 text-stone-400 group-hover:text-[#f97316] mr-3 transition-colors"/> <span className="font-black text-base text-stone-700 group-hover:text-[#f97316] transition-colors">Ver Minhas Atividades</span></Button>
                <Button variant="secondary" onClick={() => setCurrentView('grades')} className="py-8 justify-start px-8 shadow-sm hover:border-[#16a34a] group"><Icon name="check-circle" className="w-6 h-6 text-stone-400 group-hover:text-[#16a34a] mr-3 transition-colors"/> <span className="font-black text-base text-stone-700 group-hover:text-[#16a34a] transition-colors">Acessar Boletim Escolar</span></Button>
            </div>
        </div>
    );
};

const StudentActivities = () => {
    const { user, activities, classes, enrollments } = useContext(AppContext);
    const myClassesIds = enrollments.filter(e => e.studentId === user.id).map(e => e.classId);
    const available = activities.filter(a => myClassesIds.includes(a.classId));

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-3xl font-black text-[#1e1b4b] pb-4">Quadro de Atividades</h2>
            <div className="grid grid-cols-1 gap-6">
                {available.slice().reverse().map(act => (
                    <Card key={act.id} className="flex flex-col md:flex-row gap-0 p-0 border-l-4 border-l-[#eab308] overflow-hidden rounded-2xl">
                        <div className="flex-1 p-8">
                            <Badge variant="amber">Valor Máximo: {act.value} pts</Badge>
                            <h3 className="text-2xl font-black text-[#1e1b4b] mt-4">{act.title}</h3>
                            <p className="text-sm font-bold text-stone-500 mt-2">{classes.find(c=>c.id===act.classId)?.name}</p>
                            <div className="mt-6 pt-5 border-t border-yellow-100 text-xs font-black uppercase tracking-widest text-[#f97316] flex items-center gap-2">
                                <Icon name="clock" className="w-4 h-4"/> Prazo de Entrega: {act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : 'Sem prazo definido'}
                            </div>
                        </div>
                        {act.requiresSubmission !== false ? (
                            <div className="md:w-72 bg-stone-50 p-8 border-l border-yellow-100 flex flex-col justify-center gap-4 shrink-0">
                                <Button variant="secondary" icon="upload" className="w-full shadow-none border-stone-300">Anexar Arquivo</Button>
                                <Button className="w-full bg-gradient-to-r from-[#f97316] to-[#eab308] hover:shadow-lg focus:ring-[#f97316] border-none text-white">Enviar Resposta</Button>
                            </div>
                        ) : (
                            <div className="md:w-72 bg-[#16a34a]/5 p-8 border-l border-[#16a34a]/10 flex flex-col justify-center items-center text-center shrink-0">
                                <Icon name="check-circle" className="w-10 h-10 text-[#16a34a] mb-3"/>
                                <p className="text-sm font-black text-[#1e1b4b] uppercase tracking-wide">Atividade Presencial</p>
                                <p className="text-xs font-bold text-stone-600 mt-2">Aguarde o lançamento da nota pelo professor.</p>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
};

const StudentGrades = () => {
    const { user, grades, activities, classes } = useContext(AppContext);
    const myGrades = grades.filter(g => g.studentId === user.id).map(g => ({
        grade: g, act: activities.find(a => a.id === g.activityId) || {}, cls: classes.find(c => c.id === g.classId) || {}
    })).sort((a,b) => (a.act.dueDate > b.act.dueDate ? -1 : 1));
    
    let totalObtido = myGrades.reduce((a, c) => a + Number(c.grade.grade || 0), 0);
    let totalPossivel = myGrades.reduce((a, c) => a + Number(c.act.value || 0), 0);
    const percent = totalPossivel > 0 ? ((totalObtido/totalPossivel)*100).toFixed(1) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-3xl font-black text-[#1e1b4b] pb-4">Meu Boletim Escolar</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1e1b4b] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#f97316] rounded-full blur-[60px] opacity-20 -mr-10 -mt-10"></div>
                    <p className="text-indigo-200 text-sm font-black uppercase tracking-widest relative z-10">Aproveitamento Geral</p>
                    <p className="text-6xl font-black mt-4 tracking-tighter relative z-10">{percent}%</p>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-yellow-200 shadow-sm flex flex-col justify-center">
                    <p className="text-stone-500 text-sm font-black uppercase tracking-widest">Pontos Obtidos</p>
                    <p className="text-5xl font-black text-[#16a34a] mt-4 tracking-tighter">{totalObtido} <span className="text-xl font-bold text-stone-400 lowercase">pts</span></p>
                </div>
                <div className="bg-white rounded-2xl p-8 border border-yellow-200 shadow-sm flex flex-col justify-center">
                    <p className="text-stone-500 text-sm font-black uppercase tracking-widest">Total Distribuído</p>
                    <p className="text-5xl font-black text-[#1e1b4b] mt-4 tracking-tighter">{totalPossivel} <span className="text-xl font-bold text-stone-400 lowercase">pts</span></p>
                </div>
            </div>

            <Card noPadding className="mt-8 shadow-sm border-t-4 border-t-[#16a34a] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-yellow-200 bg-yellow-50">
                            <tr>
                                <th className="px-8 py-5 font-black text-stone-500 uppercase tracking-widest text-xs">Avaliação</th>
                                <th className="px-8 py-5 font-black text-stone-500 uppercase tracking-widest text-xs text-center">Data</th>
                                <th className="px-8 py-5 font-black text-stone-500 uppercase tracking-widest text-xs text-center">Valor Total</th>
                                <th className="px-8 py-5 font-black text-[#1e1b4b] uppercase tracking-widest text-xs text-center">Nota Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-100">
                            {myGrades.map(({grade, act, cls}) => (
                                <tr key={grade.id} className="hover:bg-yellow-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <span className="block font-black text-lg text-[#1e1b4b]">{act.title}</span>
                                        <span className="block font-bold text-sm text-stone-500 mt-1">{cls.name}</span>
                                    </td>
                                    <td className="px-8 py-6 text-center font-bold text-stone-500">{act.dueDate ? new Date(act.dueDate).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : '-'}</td>
                                    <td className="px-8 py-6 text-center font-bold text-stone-500">{act.value} pts</td>
                                    <td className="px-8 py-6 text-center font-black text-3xl text-[#1e1b4b]">{grade.grade}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

const MainApp = () => {
    const { user, logout } = useContext(AppContext);
    
    // Roteamento na URL (resolve o botão voltar)
    const [currentView, setCurrentView] = useState(() => {
        const hash = window.location.hash.replace('#', '');
        return hash || 'dashboard';
    });
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isProf = user.role === 'professor';

    const menu = isProf ? 
        [{ id: 'dashboard', label: 'Painel Geral', icon: 'home' }, { id: 'classes', label: 'Turmas', icon: 'book' }, { id: 'students', label: 'Alunos', icon: 'users' }, { id: 'activities', label: 'Atividades', icon: 'file-text' }, { id: 'grading', label: 'Lançar Notas', icon: 'check-circle' }] 
        : [{ id: 'dashboard', label: 'Meu Painel', icon: 'home' }, { id: 'activities', label: 'Minhas Atividades', icon: 'file-text' }, { id: 'grades', label: 'Boletim Escolar', icon: 'check-circle' }];

    // Escuta clique no botão Voltar/Avançar do Navegador
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && menu.some(item => item.id === hash)) {
                setCurrentView(hash);
            } else {
                setCurrentView('dashboard');
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [menu]);

    // Executa Navegação programática e limpa a URL
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
            <div className="h-[88px] flex flex-col justify-center px-6 shrink-0 relative overflow-hidden bg-[#1e1b4b]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#f97316] rounded-full blur-[40px] opacity-20 -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center">
                        <LogoEscola className="w-7 h-7" />
                    </div>
                    <div>
                        <span className="block font-black text-sm tracking-tight text-white uppercase leading-tight">EduGestão</span>
                        <span className="block font-bold text-[10px] text-indigo-300 uppercase tracking-widest">Portal Escolar</span>
                    </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden absolute top-6 right-6 text-white/50 hover:text-white p-1">
                    <Icon name="x" className="w-5 h-5"/>
                </button>
            </div>
            
            <div className="px-6 py-6 border-b border-yellow-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f97316] to-[#eab308] flex items-center justify-center text-white font-black text-sm shadow-md">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-black text-[#1e1b4b] text-sm truncate">{user.name}</p>
                        <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mt-0.5">{user.role}</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-5 px-4 space-y-1.5">
                {menu.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button key={item.id} onClick={() => handleNavigate(item.id)} 
                            className={`relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-black transition-all overflow-hidden group
                            ${isActive ? 'text-white shadow-md' : 'text-stone-500 hover:bg-stone-50 hover:text-[#1e1b4b]'}`}>
                            {isActive && <div className="absolute inset-0 bg-gradient-to-r from-[#f97316] to-[#eab308] z-0"></div>}
                            <Icon name={item.icon} className={`relative z-10 w-5 h-5 ${isActive ? 'text-white' : 'text-stone-400 group-hover:text-[#f97316] transition-colors'}`} />
                            <span className="relative z-10 tracking-wide">{item.label}</span>
                        </button>
                    )
                })}
            </nav>

            <div className="p-5 shrink-0">
                <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-red-100">
                    <Icon name="log-out" className="w-4 h-4"/> Sair do Sistema
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen w-full bg-[#f8fafc] font-sans text-stone-900 overflow-hidden">
            
            {/* 1. GAVETA MOBILE (Flutuante, oculta no Desktop) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex lg:hidden">
                    <div className="fixed inset-0 bg-[#1e1b4b]/60 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
                    <aside className="relative flex w-72 flex-col bg-white shadow-2xl rounded-r-3xl overflow-hidden animate-fade-in">
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* 2. ILHA FLUTUANTE DESKTOP (Fixa no layout, oculta no Mobile) */}
            <aside className="hidden lg:flex w-[280px] flex-col shrink-0 z-10 m-6 mr-0 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-yellow-200 overflow-hidden">
                <SidebarContent />
            </aside>

            {/* 3. ÁREA CENTRAL DE CONTEÚDO */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
                
                <header className="h-20 flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-yellow-200 flex items-center px-6 justify-between z-0 lg:hidden sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="text-stone-500 hover:text-[#1e1b4b] p-2 bg-white rounded-xl shadow-sm border border-yellow-200 transition-colors">
                            <Icon name="menu" className="w-6 h-6"/>
                        </button>
                        <h1 className="font-black text-[#1e1b4b] text-base tracking-wide uppercase">
                            {menu.find(m => m.id === currentView)?.label || 'Painel'}
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 scroll-smooth">
                    <div className="hidden lg:flex items-center justify-between mb-8 max-w-6xl mx-auto">
                         <h1 className="font-black text-[#1e1b4b] text-2xl tracking-tight uppercase">
                            {menu.find(m => m.id === currentView)?.label || 'Painel'}
                        </h1>
                        <Badge variant="amber">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Badge>
                    </div>
                    <div className="max-w-6xl mx-auto pb-16">
                        {renderView()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('edugestao_session')));
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = globalStyles;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    const data = useMemo(() => ({
        classes: dbService.get('classes'),
        allStudents: dbService.get('students'),
        activities: dbService.get('activities'),
        submissions: dbService.get('submissions'),
        enrollments: dbService.get('enrollments'),
        grades: dbService.get('grades')
    }), [refreshTick]);

    const login = (u) => { sessionStorage.setItem('edugestao_session', JSON.stringify(u)); setUser(u); };
    const logout = () => { sessionStorage.removeItem('edugestao_session'); window.location.hash = ''; setUser(null); };
    const refreshData = () => setRefreshTick(prev => prev + 1);

    return (
        <AppContext.Provider value={{ user, login, logout, refreshData, ...data }}>
            {user ? <MainApp /> : <LoginScreen />}
        </AppContext.Provider>
    );
}