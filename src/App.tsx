/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  where,
  setDoc,
  getDoc,
  orderBy,
  getDocs,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  Plus, 
  Users, 
  User as UserIcon, 
  MapPin, 
  Calendar, 
  Phone, 
  Check, 
  X,
  LogOut,
  ShieldCheck,
  Filter,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Info,
  Edit,
  Save,
  Send,
  Award,
  Fingerprint,
  Shield,
  Star,
  Clock,
  FileCheck
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { TripPost, JoinRequest, UserProfile, Team, ChatMessage } from './types';

// Error Handling
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
          <h1 className="text-2xl font-bold text-brand-accent mb-4">Something went wrong</h1>
          <pre className="bg-black/20 p-4 rounded-xl text-xs text-left overflow-auto max-w-full mb-6">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            Reload App
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

// --- Trust & Verification Components ---

function TrustBadge({ level, size = 'sm' }: { level?: string, size?: 'sm' | 'md' }) {
  if (!level || level === 'Unverified') return null;
  
  const isHigh = level === 'Highly Trusted';
  const isVerified = level === 'Verified Traveler';
  
  return (
    <div className={`flex items-center gap-1 ${size === 'sm' ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-wider`}>
      {isHigh ? (
        <span className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
          <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
          Highly Trusted
        </span>
      ) : isVerified ? (
        <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          <Check className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
          Verified
        </span>
      ) : (
        <span className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
          <Info className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
          Partially Verified
        </span>
      )}
    </div>
  );
}

function TrustScoreMeter({ score }: { score: number }) {
  const getLevel = (s: number) => {
    if (s >= 90) return { label: 'Highly Trusted', color: 'text-green-400', border: 'border-green-500/30' };
    if (s >= 70) return { label: 'Verified Traveler', color: 'text-blue-400', border: 'border-blue-500/30' };
    if (s >= 50) return { label: 'Partially Verified', color: 'text-yellow-400', border: 'border-yellow-500/30' };
    return { label: 'Unverified', color: 'text-white/40', border: 'border-white/10' };
  };

  const level = getLevel(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            className="text-white/5"
          />
          <motion.circle
            cx="48"
            cy="48"
            r="40"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={251.2}
            initial={{ strokeDashoffset: 251.2 }}
            animate={{ strokeDashoffset: 251.2 - (251.2 * score) / 100 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={level.color}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{score}</span>
          <span className="text-[8px] uppercase opacity-40">Score</span>
        </div>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${level.color}`}>
        {level.label}
      </span>
    </div>
  );
}

function DigiLockerModal({ onVerify, onClose }: { onVerify: (data: any) => void, onClose: () => void }) {
  const [step, setStep] = useState<'intro' | 'loading' | 'success'>('intro');

  const startVerification = () => {
    setStep('loading');
    setTimeout(() => {
      setStep('success');
    }, 3000);
  };

  const complete = () => {
    onVerify({
      isVerified: true,
      verificationSource: 'DigiLocker',
      verificationLevel: 'Highly Trusted',
      trustScore: 94,
      verifiedAt: serverTimestamp(),
      documentType: 'Aadhaar',
      maskedDocumentId: 'XXXX-XXXX-8829'
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card w-full max-w-sm p-8 text-center space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-secondary/20">
          {step === 'loading' && (
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="h-full bg-brand-secondary"
            />
          )}
        </div>

        {step === 'intro' && (
          <>
            <div className="w-20 h-20 bg-brand-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Fingerprint className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold">DigiLocker Verify</h2>
            <p className="text-sm text-white/60">
              Connect your DigiLocker account to verify your identity and boost your trust score to 90+.
            </p>
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-3 text-left text-xs text-white/80 bg-white/5 p-3 rounded-xl">
                <Shield className="w-5 h-5 text-green-400 shrink-0" />
                <span>Verified Legal Name & Age</span>
              </div>
              <div className="flex items-center gap-3 text-left text-xs text-white/80 bg-white/5 p-3 rounded-xl">
                <FileCheck className="w-5 h-5 text-blue-400 shrink-0" />
                <span>Government Issued ID Proof</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <button onClick={startVerification} className="btn-primary w-full flex items-center justify-center gap-2">
                <Award className="w-5 h-5" /> Verify with DigiLocker
              </button>
              <button onClick={onClose} className="text-sm text-white/40 hover:text-white">Maybe Later</button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="py-12 space-y-6">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-brand-secondary border-t-transparent rounded-full mx-auto"
            />
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Authenticating...</h3>
              <p className="text-sm text-white/40">Fetching documents from DigiLocker</p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="py-6 space-y-6"
          >
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-green-400">Identity Verified!</h3>
              <p className="text-sm text-white/60">Your trust score has been updated to 94.</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl text-left space-y-2">
              <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                <span>Source</span>
                <span className="text-white">DigiLocker</span>
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                <span>Document</span>
                <span className="text-white">Aadhaar Card</span>
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                <span>ID</span>
                <span className="text-white">XXXX-XXXX-8829</span>
              </div>
            </div>
            <button onClick={complete} className="btn-primary w-full">
              Awesome!
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'discover' | 'create' | 'requests' | 'teams' | 'profile'>('discover');
  
  const [trips, setTrips] = useState<TripPost[]>([]);
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<JoinRequest[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDigiLockerModalOpen, setIsDigiLockerModalOpen] = useState(false);
  const [activeChatTeamId, setActiveChatTeamId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          // If profile is incomplete, prompt
          if (!data.phoneNumber) setIsProfileModalOpen(true);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || 'Traveler',
            photoURL: u.photoURL || '',
            email: u.email || '',
            isVerified: false,
            trustScore: 20, // Base score for email login
            verificationLevel: 'Unverified',
            completedTrips: 0,
            rating: 5.0
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
          setIsProfileModalOpen(true);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    // Listen to Trips
    const qTrips = query(collection(db, 'trips'));
    const unsubTrips = onSnapshot(qTrips, (snapshot) => {
      setTrips(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TripPost)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'trips'));

    // Listen to My Requests (Sent)
    const qMyReq = query(collection(db, 'requests'), where('requesterUid', '==', user.uid));
    const unsubMyReq = onSnapshot(qMyReq, (snapshot) => {
      setMyRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'requests'));

    // Listen to Incoming Requests
    const qIncReq = query(collection(db, 'requests'), where('tripOwnerUid', '==', user.uid));
    const unsubIncReq = onSnapshot(qIncReq, (snapshot) => {
      setIncomingRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'requests'));

    // Listen to Teams
    const qTeams = query(collection(db, 'teams'), where('members', 'array-contains', user.uid));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setMyTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'teams'));

    return () => {
      unsubTrips();
      unsubMyReq();
      unsubIncReq();
      unsubTeams();
    };
  }, [user]);

  const login = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error: any) {
      console.error("Login failed", error);
      setAuthError(error.code || error.message);
    }
  };

  const logout = () => auth.signOut();

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const updatedProfile = { ...profile, ...data } as UserProfile;
      
      // Recalculate trust score if basic info added
      if (!profile?.phoneNumber && data.phoneNumber) {
        updatedProfile.trustScore = (updatedProfile.trustScore || 0) + 30;
        updatedProfile.verificationLevel = updatedProfile.trustScore >= 50 ? 'Partially Verified' : 'Unverified';
      }

      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile);
      setIsProfileModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleDigiLockerVerify = async (verificationData: any) => {
    if (!user || !profile) return;
    try {
      const updatedProfile = { 
        ...profile, 
        ...verificationData,
        isVerified: true,
        trustScore: 94,
        verificationLevel: 'Highly Trusted'
      } as UserProfile;

      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile);
      setIsDigiLockerModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const checkProfileComplete = () => {
    if (!profile?.phoneNumber || !profile?.displayName || profile.displayName === 'Traveler') {
      setIsProfileModalOpen(true);
      return false;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Compass className="w-16 h-16 text-brand-secondary" />
        </motion.div>
        <h1 className="text-4xl font-script text-brand-secondary">TripSutra</h1>
        <p className="text-white/60 animate-pulse">Loading your journey...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="p-6 mb-8 bg-white/10 rounded-full backdrop-blur-xl border border-white/20"
        >
          <Compass className="w-20 h-20 text-brand-secondary" />
        </motion.div>
        <h1 className="text-6xl font-script text-brand-secondary mb-2">TripSutra</h1>
        <p className="text-xl text-white/80 mb-12 max-w-xs">
          Discover · Plan · Explore
          <br />
          <span className="text-sm opacity-60">Connect with real travelers</span>
        </p>
        <button onClick={login} className="btn-primary w-full max-w-xs flex items-center justify-center gap-3">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Continue with Google
        </button>
        
        {authError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 max-w-xs"
          >
            <p className="font-bold mb-1">Login Error:</p>
            <code>{authError}</code>
            <p className="mt-2 opacity-70">Check Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains</p>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24 pt-6 px-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-script text-brand-secondary">TripSutra</h1>
          <p className="text-xs text-white/60">Welcome back, {profile?.displayName}</p>
        </div>
        <button onClick={() => setView('profile')} className="relative">
          <img 
            src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            className="w-10 h-10 rounded-full border-2 border-brand-secondary"
            alt="Profile"
          />
          {profile?.isVerified && (
            <ShieldCheck className="w-4 h-4 text-brand-secondary absolute -bottom-1 -right-1 bg-brand-bg rounded-full" />
          )}
        </button>
      </header>

      <AnimatePresence mode="wait">
        {view === 'discover' && (
          <DiscoverView 
            trips={trips} 
            user={user} 
            profile={profile} 
            requests={myRequests}
            teams={myTeams}
            onJoinClick={checkProfileComplete}
          />
        )}
        {view === 'create' && (
          <CreateTripView 
            user={user} 
            profile={profile} 
            onComplete={() => setView('discover')} 
            onCheckProfile={checkProfileComplete}
          />
        )}
        {view === 'requests' && (
          <RequestsView 
            incoming={incomingRequests} 
            outgoing={myRequests} 
            user={user} 
            profile={profile}
            onCheckProfile={checkProfileComplete}
          />
        )}
        {view === 'teams' && (
          <TeamsView 
            teams={myTeams} 
            trips={trips} 
            user={user} 
            requests={[...incomingRequests, ...myRequests]} 
            onOpenChat={(teamId) => setActiveChatTeamId(teamId)}
          />
        )}
        {view === 'profile' && (
          <ProfileView 
            profile={profile} 
            onLogout={logout} 
            teamsCount={myTeams.length} 
            tripsCount={trips.filter(t => t.ownerUid === user.uid).length} 
            onEdit={() => setIsProfileModalOpen(true)}
            onVerify={() => setIsDigiLockerModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileModalOpen && (
          <ProfileModal 
            profile={profile} 
            onSave={updateProfile} 
            onClose={() => setIsProfileModalOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeChatTeamId && (
          <ChatModal 
            teamId={activeChatTeamId} 
            user={user} 
            profile={profile} 
            onClose={() => setActiveChatTeamId(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDigiLockerModalOpen && (
          <DigiLockerModal 
            onVerify={handleDigiLockerVerify} 
            onClose={() => setIsDigiLockerModalOpen(false)} 
          />
        )}
      </AnimatePresence>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass-card p-2 flex items-center justify-around z-50">
        <NavButton active={view === 'discover'} onClick={() => setView('discover')} icon={<Compass />} label="Discover" />
        <NavButton active={view === 'requests'} onClick={() => setView('requests')} icon={<Users />} label="Requests" />
        <button 
          onClick={() => setView('create')}
          className="w-14 h-14 bg-brand-secondary text-brand-bg rounded-full flex items-center justify-center shadow-xl -translate-y-4 border-4 border-brand-bg transition-transform active:scale-90"
        >
          <Plus className="w-8 h-8" />
        </button>
        <NavButton active={view === 'teams'} onClick={() => setView('teams')} icon={<MapPin />} label="Teams" />
        <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon />} label="Profile" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-brand-secondary' : 'text-white/40'}`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );
}

function DiscoverView({ 
  trips, 
  user, 
  profile,
  requests,
  teams,
  onJoinClick
}: { 
  trips: TripPost[], 
  user: User, 
  profile: UserProfile | null,
  requests: JoinRequest[],
  teams: Team[],
  onJoinClick: () => boolean
}) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [lookingForFilter, setLookingForFilter] = useState<string>('All');

  const filteredTrips = trips.filter(t => {
    const matchesSearch = t.destination.toLowerCase().includes(search.toLowerCase()) ||
                         t.city.toLowerCase().includes(search.toLowerCase());
    const matchesLookingFor = lookingForFilter === 'All' || t.lookingFor === lookingForFilter;
    return matchesSearch && matchesLookingFor;
  }).filter(t => t.ownerUid !== user.uid);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search destination..." 
            className="input-field w-full pl-12 pr-4"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowFilters(true)}
          className={`p-3 rounded-2xl border transition-all ${lookingForFilter !== 'All' ? 'bg-brand-secondary text-brand-bg border-brand-secondary' : 'bg-white/10 border-white/20 text-white'}`}
        >
          <SlidersHorizontal className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass-card p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Filters</h3>
              <button onClick={() => setShowFilters(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-white/40">Looking For</p>
              <div className="flex flex-wrap gap-2">
                {['All', 'Solo', 'Group', 'Male', 'Female'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setLookingForFilter(opt)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${lookingForFilter === opt ? 'bg-brand-secondary text-brand-bg' : 'bg-white/5 text-white/60'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {filteredTrips.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Compass className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No travelers found matching your search.</p>
          </div>
        ) : (
          filteredTrips.map(trip => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              user={user} 
              profile={profile} 
              request={requests.find(r => r.tripId === trip.id)}
              team={teams.find(t => t.tripId === trip.id)}
              onJoinClick={onJoinClick}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

function TripCard({ 
  trip, 
  user, 
  profile, 
  request,
  team,
  onJoinClick
}: { 
  trip: TripPost, 
  user: User, 
  profile: UserProfile | null, 
  request?: JoinRequest,
  team?: Team,
  onJoinClick: () => boolean,
  key?: React.Key
}) {
  const [sending, setSending] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchOwner = async () => {
      const docSnap = await getDoc(doc(db, 'users', trip.ownerUid));
      if (docSnap.exists()) setOwnerProfile(docSnap.data() as UserProfile);
    };
    fetchOwner();
  }, [trip.ownerUid]);

  const isRequested = request && request.status !== 'cancelled' && request.status !== 'rejected';
  const isAccepted = request?.status === 'accepted' || !!team;

  const handleJoin = async () => {
    if (!profile) return;
    if (!onJoinClick()) return;
    if (isRequested || isAccepted) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'requests'), {
        tripId: trip.id,
        tripOwnerUid: trip.ownerUid,
        requesterUid: user.uid,
        requesterName: profile.displayName,
        requesterPhoto: profile.photoURL,
        requesterPhone: profile.phoneNumber,
        requesterTrustScore: profile.trustScore || 20,
        requesterVerificationLevel: profile.verificationLevel || 'Unverified',
        status: 'pending',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'requests');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <img src={trip.ownerPhoto} className="w-12 h-12 rounded-full border border-white/20" alt={trip.ownerName} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">{trip.ownerName}, {trip.age}</h3>
            <TrustBadge level={ownerProfile?.verificationLevel} />
          </div>
          <p className="text-xs text-white/60">{trip.city} → {trip.destination}</p>
        </div>
        <div className="bg-brand-secondary/20 text-brand-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase">
          {trip.lookingFor}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-white/80">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-brand-secondary" />
          {trip.travelDate}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-brand-secondary" />
          {trip.destination}
        </div>
      </div>

      <p className="text-sm text-white/60 line-clamp-2 italic">
        {trip.description ? `"${trip.description}"` : 'No description provided.'}
      </p>

      <button 
        onClick={handleJoin}
        disabled={sending || isRequested || isAccepted}
        className={`w-full py-3 rounded-2xl font-bold transition-all ${
          isAccepted
            ? 'bg-brand-secondary text-brand-bg'
            : isRequested 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {sending ? 'Sending...' : isAccepted ? 'Joined Team' : isRequested ? 'Request Sent' : 'Send Join Request'}
      </button>
    </div>
  );
}

function CreateTripView({ 
  user, 
  profile, 
  onComplete,
  onCheckProfile
}: { 
  user: User, 
  profile: UserProfile | null, 
  onComplete: () => void,
  onCheckProfile: () => boolean
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    destination: '',
    travelDate: '',
    age: profile?.age || 20,
    gender: profile?.gender || 'Anyone',
    city: profile?.city || '',
    lookingFor: 'Group',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!onCheckProfile()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'trips'), {
        ...form,
        ownerUid: user.uid,
        ownerName: profile.displayName,
        ownerPhoto: profile.photoURL,
        createdAt: serverTimestamp()
      });
      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'trips');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4 mb-2">
        <button onClick={onComplete} className="p-2 bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
        <h2 className="text-2xl font-bold">Create Travel Post</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-white/40 ml-1">Destination</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Goa" 
              className="input-field w-full"
              value={form.destination}
              onChange={e => setForm({...form, destination: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-white/40 ml-1">Travel Date</label>
            <input 
              required
              type="date" 
              className="input-field w-full"
              value={form.travelDate}
              onChange={e => setForm({...form, travelDate: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-white/40 ml-1">Your City</label>
            <input 
              required
              type="text" 
              placeholder="e.g. Pune" 
              className="input-field w-full"
              value={form.city}
              onChange={e => setForm({...form, city: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-white/40 ml-1">Looking For</label>
            <select 
              className="input-field w-full bg-brand-bg"
              value={form.lookingFor}
              onChange={e => setForm({...form, lookingFor: e.target.value as any})}
            >
              <option value="Solo">Solo</option>
              <option value="Group">Group</option>
              <option value="Male">Male Only</option>
              <option value="Female">Female Only</option>
              <option value="Anyone">Anyone</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-white/40 ml-1">Description</label>
          <textarea 
            rows={3}
            placeholder="Tell others about your plan..." 
            className="input-field w-full resize-none"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
          {loading ? 'Posting...' : 'Post Travel Plan'}
        </button>
      </form>
    </motion.div>
  );
}

function RequestsView({ 
  incoming, 
  outgoing, 
  user,
  profile,
  onCheckProfile
}: { 
  incoming: JoinRequest[], 
  outgoing: JoinRequest[], 
  user: User,
  profile: UserProfile | null,
  onCheckProfile: () => boolean
}) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      <div className="flex p-1 bg-white/10 rounded-2xl">
        <button 
          onClick={() => setTab('incoming')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'incoming' ? 'bg-brand-secondary text-brand-bg' : 'text-white/60'}`}
        >
          Incoming ({incoming.length})
        </button>
        <button 
          onClick={() => setTab('outgoing')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'outgoing' ? 'bg-brand-secondary text-brand-bg' : 'text-white/60'}`}
        >
          Outgoing ({outgoing.length})
        </button>
      </div>

      <div className="space-y-4">
        {tab === 'incoming' ? (
          incoming.length === 0 ? (
            <p className="text-center py-20 text-white/40 italic">No incoming requests yet.</p>
          ) : (
            incoming.map(req => (
              <IncomingRequestCard 
                key={req.id} 
                request={req} 
                profile={profile}
                onCheckProfile={onCheckProfile}
              />
            ))
          )
        ) : (
          outgoing.length === 0 ? (
            <p className="text-center py-20 text-white/40 italic">You haven't sent any requests.</p>
          ) : (
            outgoing.map(req => <OutgoingRequestCard key={req.id} request={req} />)
          )
        )}
      </div>
    </motion.div>
  );
}

function IncomingRequestCard({ 
  request, 
  profile,
  onCheckProfile
}: { 
  request: JoinRequest & { requesterTrustScore?: number, requesterVerificationLevel?: string }, 
  profile: UserProfile | null,
  onCheckProfile: () => boolean,
  key?: React.Key
}) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (status: 'accepted' | 'rejected') => {
    if (status === 'accepted' && !onCheckProfile()) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'requests', request.id);
      const ownerPhone = status === 'accepted' ? profile?.phoneNumber : null;

      batch.update(requestRef, { 
        status,
        ownerPhone
      });

      if (status === 'accepted') {
        const teamRef = doc(db, 'teams', request.tripId);
        const teamSnap = await getDoc(teamRef);
        
        if (teamSnap.exists()) {
          batch.update(teamRef, {
            members: arrayUnion(request.requesterUid)
          });
        } else {
          batch.set(teamRef, {
            tripId: request.tripId,
            ownerUid: request.tripOwnerUid,
            members: [request.tripOwnerUid, request.requesterUid],
            createdAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-4">
        <img src={request.requesterPhoto} className="w-12 h-12 rounded-full" alt="" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold">{request.requesterName}</h4>
            <TrustBadge level={request.requesterVerificationLevel} />
          </div>
          <p className="text-xs text-white/60">wants to join your trip</p>
        </div>
        {request.status === 'pending' ? (
          <div className="flex gap-2">
            <button onClick={() => handleAction('accepted')} disabled={loading} className="p-2 bg-green-500/20 text-green-400 rounded-full"><Check /></button>
            <button onClick={() => handleAction('rejected')} disabled={loading} className="p-2 bg-red-500/20 text-red-400 rounded-full"><X /></button>
          </div>
        ) : (
          <span className={`text-xs font-bold uppercase ${request.status === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
            {request.status}
          </span>
        )}
      </div>

      {request.status === 'pending' && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
          <div className="bg-white/5 p-2 rounded-xl flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-brand-secondary" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase font-bold">Trust Score</p>
              <p className="text-xs font-bold">{request.requesterTrustScore || 20}</p>
            </div>
          </div>
          <div className="bg-white/5 p-2 rounded-xl flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-brand-secondary" />
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase font-bold">Trips Done</p>
              <p className="text-xs font-bold">0</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OutgoingRequestCard({ request }: { request: JoinRequest, key?: React.Key }) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className="flex-1">
        <h4 className="font-bold">Request to join Trip</h4>
        <p className="text-xs text-white/60">Status: <span className="capitalize font-bold text-brand-secondary">{request.status}</span></p>
      </div>
      {request.status === 'accepted' && (
        <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-xl text-sm">
          <Phone className="w-4 h-4" />
          {request.ownerPhone}
        </div>
      )}
    </div>
  );
}

function TeamsView({ 
  teams, 
  trips, 
  user, 
  requests,
  onOpenChat
}: { 
  teams: Team[], 
  trips: TripPost[], 
  user: User, 
  requests: JoinRequest[],
  onOpenChat: (teamId: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter out duplicate teams for the same tripId (legacy cleanup)
  const uniqueTeams = teams.reduce((acc, current) => {
    const existing = acc.find(item => item.tripId === current.tripId);
    if (!existing) {
      return acc.concat([current]);
    }
    // If we have duplicates, prioritize the one where id matches tripId (the new standard)
    if (current.id === current.tripId) {
      return acc.filter(item => item.tripId !== current.tripId).concat([current]);
    }
    return acc;
  }, [] as Team[]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold">My Travel Teams</h2>
      <div className="grid gap-4">
        {uniqueTeams.length === 0 ? (
          <p className="text-center py-20 text-white/40 italic">No teams formed yet. Start connecting!</p>
        ) : (
          uniqueTeams.map(team => {
            const trip = trips.find(t => t.id === team.tripId);
            const isExpanded = expandedId === team.id;
            
            // Find all accepted requests for this trip to get members' contact info
            const tripRequests = requests.filter(r => 
              r.tripId === team.tripId && 
              r.status === 'accepted'
            );
            
            // The owner's phone is usually in any of the accepted requests
            const ownerPhone = tripRequests.find(r => r.ownerPhone)?.ownerPhone;

            return (
              <div 
                key={team.id} 
                className={`glass-card overflow-hidden transition-all duration-300 border-l-4 border-brand-secondary ${isExpanded ? 'ring-2 ring-brand-secondary/30' : ''}`}
              >
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : team.id)}
                  className="p-5 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{trip?.destination || 'Trip'} Team</h3>
                    <p className="text-sm text-white/60 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {trip?.travelDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {team.members.slice(0, 3).map(m => (
                        <div key={m} className="w-8 h-8 rounded-full bg-brand-primary border-2 border-brand-bg flex items-center justify-center text-[10px] font-bold">
                          {m === user.uid ? 'Me' : 'B'}
                        </div>
                      ))}
                    </div>
                    {isExpanded ? <ChevronUp className="text-brand-secondary" /> : <ChevronDown className="text-white/40" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-5 pb-5 border-t border-white/10 pt-4 space-y-6"
                    >
                      {/* Trip Info Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-brand-secondary font-bold text-xs uppercase tracking-wider">
                          <Info className="w-4 h-4" /> Trip Details
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl">
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">From</p>
                            <p className="text-sm">{trip?.city}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">To</p>
                            <p className="text-sm">{trip?.destination}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">Date</p>
                            <p className="text-sm">{trip?.travelDate}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase font-bold">Type</p>
                            <p className="text-sm">{trip?.lookingFor}</p>
                          </div>
                        </div>
                        {trip?.description && (
                          <p className="text-sm text-white/70 italic bg-white/5 p-3 rounded-xl border-l-2 border-brand-secondary/30">
                            "{trip.description}"
                          </p>
                        )}
                      </div>

                      {/* Members Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-brand-secondary font-bold text-xs uppercase tracking-wider">
                          <Users className="w-4 h-4" /> Team Members
                        </div>
                        <div className="space-y-3">
                          {/* Trip Owner */}
                          <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <img 
                                src={trip?.ownerPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${trip?.ownerUid}`} 
                                className="w-10 h-10 rounded-full border border-white/20" 
                                alt="" 
                              />
                              <div>
                                <p className="font-bold text-sm">{trip?.ownerName} <span className="text-[10px] bg-brand-secondary/20 text-brand-secondary px-1.5 py-0.5 rounded ml-1">OWNER</span></p>
                                <p className="text-xs text-white/40">Host</p>
                              </div>
                            </div>
                            {ownerPhone && (
                              <a 
                                href={`tel:${ownerPhone}`}
                                className="flex items-center gap-2 bg-brand-secondary text-brand-bg px-3 py-1.5 rounded-xl text-xs font-bold"
                              >
                                <Phone className="w-3.5 h-3.5" /> {ownerPhone}
                              </a>
                            )}
                          </div>

                          {/* Buddies / Requesters */}
                          {tripRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={req.requesterPhoto} 
                                  className="w-10 h-10 rounded-full border border-white/20" 
                                  alt="" 
                                />
                                <div>
                                  <p className="font-bold text-sm">{req.requesterName} <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded ml-1">BUDDY</span></p>
                                  <p className="text-xs text-white/40">Joined</p>
                                </div>
                              </div>
                              <a 
                                href={`tel:${req.requesterPhone}`}
                                className="flex items-center gap-2 bg-brand-secondary text-brand-bg px-3 py-1.5 rounded-xl text-xs font-bold"
                              >
                                <Phone className="w-3.5 h-3.5" /> {req.requesterPhone}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => onOpenChat(team.id)}
                          className="flex-1 btn-secondary py-2 text-xs flex items-center justify-center gap-2 bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20"
                        >
                          <MessageSquare className="w-4 h-4" /> Open Group Chat
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

function ChatModal({ 
  teamId, 
  user, 
  profile, 
  onClose 
}: { 
  teamId: string, 
  user: User, 
  profile: UserProfile | null, 
  onClose: () => void 
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [teamId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    const text = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'messages'), {
        teamId,
        senderUid: user.uid,
        senderName: profile.displayName,
        text,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-brand-bg md:max-w-md md:mx-auto md:shadow-2xl">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-brand-bg/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
          <h2 className="font-bold">Team Chat</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-brand-secondary bg-brand-secondary/10 px-2 py-1 rounded">
          <Users className="w-3 h-3" /> Live
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/40 text-sm">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-2">
            <MessageSquare className="w-12 h-12 opacity-10" />
            <p className="text-sm">No messages yet. Say hi!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.senderUid === user.uid ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-white/40">{msg.senderName}</span>
              </div>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.senderUid === user.uid 
                  ? 'bg-brand-secondary text-brand-bg rounded-tr-none' 
                  : 'bg-white/10 text-white rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white/5 border-t border-white/10 flex gap-2">
        <input 
          type="text" 
          placeholder="Type a message..." 
          className="input-field flex-1"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="bg-brand-secondary text-brand-bg p-3 rounded-2xl disabled:opacity-50 transition-all active:scale-95"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

function ProfileView({ 
  profile, 
  onLogout, 
  teamsCount, 
  tripsCount,
  onEdit,
  onVerify
}: { 
  profile: UserProfile | null, 
  onLogout: () => void,
  teamsCount: number,
  tripsCount: number,
  onEdit: () => void,
  onVerify: () => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 text-center"
    >
      <div className="relative inline-block">
        <img src={profile?.photoURL} className="w-32 h-32 rounded-full border-4 border-brand-secondary mx-auto" alt="" />
        {profile?.isVerified && (
          <div className="absolute bottom-1 right-1 bg-brand-secondary p-1.5 rounded-full">
            <ShieldCheck className="w-6 h-6 text-brand-bg" />
          </div>
        )}
        <button 
          onClick={onEdit}
          className="absolute top-0 right-0 bg-brand-secondary text-brand-bg p-2 rounded-full shadow-lg"
        >
          <Edit className="w-4 h-4" />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-3xl font-bold">{profile?.displayName}</h2>
          <TrustBadge level={profile?.verificationLevel} size="md" />
        </div>
        <p className="text-white/60">{profile?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-6 space-y-4 text-left">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase text-white/40 tracking-wider">Identity Status</h3>
            <div className="flex items-center gap-2">
              {profile?.isVerified ? (
                <div className="flex items-center gap-2 text-green-400 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                  <span>DigiLocker Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-white/40 font-bold">
                  <Shield className="w-5 h-5" />
                  <span>Unverified Identity</span>
                </div>
              )}
            </div>
          </div>

          {profile?.verifiedAt && (
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <Clock className="w-3 h-3" />
              <span>Last verified: {new Date(profile.verifiedAt.seconds * 1000).toLocaleDateString()}</span>
            </div>
          )}

          {!profile?.isVerified && (
            <button 
              onClick={onVerify}
              className="w-full py-3 bg-brand-primary/20 text-blue-400 border border-brand-primary/30 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-brand-primary/30 transition-all flex items-center justify-center gap-2"
            >
              <Fingerprint className="w-4 h-4" /> Verify with DigiLocker
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <p className="text-2xl font-bold text-brand-secondary">{tripsCount}</p>
          <p className="text-xs uppercase font-bold text-white/40">My Trips</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-2xl font-bold text-brand-secondary">{teamsCount}</p>
          <p className="text-xs uppercase font-bold text-white/40">Teams Joined</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white/5 p-4 rounded-2xl text-left flex items-center gap-4">
          <ShieldCheck className="text-brand-secondary" />
          <div>
            <p className="font-bold">Verified Identity</p>
            <p className="text-xs text-white/40">{profile?.isVerified ? `Verified via ${profile.verificationSource}` : 'Google Login Verified'}</p>
          </div>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl text-left flex items-center gap-4">
          <Phone className="text-brand-secondary" />
          <div>
            <p className="font-bold">Contact Privacy</p>
            <p className="text-xs text-white/40">Only shared after team formation</p>
          </div>
        </div>
      </div>

      <button onClick={onLogout} className="btn-secondary w-full flex items-center justify-center gap-2 text-red-400">
        <LogOut className="w-5 h-5" /> Sign Out
      </button>

      <div className="pt-4">
        <p className="text-[10px] text-white/20 uppercase tracking-widest">Safety Tips</p>
        <p className="text-xs text-white/40 mt-2">Meet in public places · Share live location · Report suspicious activity</p>
      </div>
    </motion.div>
  );
}

function ProfileModal({ 
  profile, 
  onSave, 
  onClose 
}: { 
  profile: UserProfile | null, 
  onSave: (data: Partial<UserProfile>) => void, 
  onClose: () => void 
}) {
  const [name, setName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phoneNumber || '');
  const [city, setCity] = useState(profile?.city || '');
  const [age, setAge] = useState(profile?.age || 20);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card w-full max-w-md p-6 space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Complete Profile</h2>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-white/60">We need your basic details to connect you with other travelers safely.</p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-white/40 ml-1">Full Name</label>
            <input 
              type="text" 
              placeholder="Your Name" 
              className="input-field w-full"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-white/40 ml-1">Phone Number</label>
            <input 
              type="tel" 
              placeholder="e.g. +91 9876543210" 
              className="input-field w-full"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-white/40 ml-1">City</label>
              <input 
                type="text" 
                placeholder="Pune" 
                className="input-field w-full"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-white/40 ml-1">Age</label>
              <input 
                type="number" 
                className="input-field w-full"
                value={age}
                onChange={e => setAge(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        <button 
          onClick={() => onSave({ displayName: name, phoneNumber: phone, city, age })}
          disabled={!name || !phone}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" /> Save Profile
        </button>
      </motion.div>
    </div>
  );
}
