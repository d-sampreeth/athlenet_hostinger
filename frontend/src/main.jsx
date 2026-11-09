import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Award, Bell, CalendarDays, Check, ChevronRight, CircleUserRound, Clock3, Edit3, Eye, EyeOff,
  Home, LogOut, MapPin, Menu, MessageCircle, MessageSquare, Newspaper, Plus, Search,
  Send, Settings, ShieldCheck, Target, Trophy, UserPlus, Users, X, Upload, Filter,
  BriefcaseBusiness, Globe2, SlidersHorizontal, ArrowUpRight, Activity, Sparkles
} from 'lucide-react';
import { API, API_ORIGIN } from './api';
import './index.css';
import CommunityFeed from './components/CommunityFeed';
import ProfileEditor from './components/ProfileEditor';
import PostActions from './components/PostActions';
import LocalHub from './components/LocalHub';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const SPORTS = [
  'Amateur Soft Tennis', 'American Football', 'American Football (Flag)', 'Alpine Skiing',
  'Aquatics', 'Archery', 'Arm Wrestling', 'Artistic Swimming', 'Athletics', 'Badminton',
  'Ball Badminton', 'Baseball', 'Basketball', 'Biathlon', 'Billiards', 'Billiards and Snooker',
  'Blind Cricket', 'Bodybuilding', 'Bobsleigh', 'Boxing', 'Breaking', 'BMX Cycling', 'Canoeing',
  'Canoe Sprint', 'Canoe Slalom', 'Carrom', 'Chess', 'Cross Country Running',
  'Cross-Country Skiing', 'Cricket', 'Curling', 'Cycle Polo', 'Cycling', 'Deaf Sports',
  'Drone Racing', 'Duathlon', 'Equestrian', 'Equestrian Endurance', 'E-sports', 'Fencing',
  'Field Archery', 'Figure Skating', 'Floorball', 'Football', 'Footvolley', 'Golf', 'Gymnastics',
  'Handball', 'Hockey', 'Ice Hockey', 'Ice Skating', 'Judo', 'Ju-Jitsu', 'Kabaddi',
  'Kalaripayattu', 'Kambala', 'Karate', 'Kayaking', 'Kickboxing', 'Kho-Kho', 'Korfball',
  'Kudo', 'Lacrosse', 'Lagori (Seven Stones)', 'Langdi', 'Luge', 'Mallakhamb', 'Maramadi',
  'Mixed Martial Arts (MMA)', 'Modern Pentathlon', 'Mountain Biking', 'Mountain Climbing',
  'Mountaineering', 'Muay Thai', 'Nadan Panthu Kali', 'Netball', 'Obstacle Course Racing',
  'Orienteering', 'Pachisi', 'Padel', 'Para Archery', 'Para Athletics', 'Para Badminton',
  'Para Shooting', 'Para Sports', 'Para Sports – Wheelchair', 'Para Swimming', 'Paragliding',
  'Parapente', 'Pencak Silat', 'Pickleball', 'Polo', 'Polo Cross', 'Powerlifting',
  'Racquetball', 'Rafting', 'Rock Climbing', 'Roll Ball', 'Roller Skating', 'Rope Skipping',
  'Rowing', 'Rounders', 'Rugby', 'Rugby Sevens', 'Sailing', 'Sambo', 'Shooting',
  'Shooting Ball', 'Silambam', 'Skeleton', 'Skateboarding', 'Skating – Speed',
  'Ski Mountaineering', 'Skiing – Alpine', 'Skiing – Cross-Country', 'Snowboarding', 'Softball',
  'Special Olympics Sports', 'Speed Skating', 'Sport Climbing', 'Sport Fishing', 'Squash',
  'Sumo Wrestling', 'Surfing', 'Swimming', 'Table Tennis', 'Taekwondo', 'Tennis',
  'Tennis Ball Cricket', 'Tennikoit', 'Teqball', 'Tenpin Bowling', 'Thang-Ta',
  'Traditional Games', 'Traditional Indian Board Games', 'Traditional Indian Wrestling',
  'Trekking', 'Triathlon', 'Tug of War', 'Tug Rugby', 'Underwater Sports', 'Ultimate Frisbee',
  'Vallam Kali (Boat Racing)', 'Volleyball', 'Wakeboarding', 'Water Polo', 'Water Skiing',
  'Weightlifting', 'Wheelchair Basketball', 'Wheelchair Tennis', 'Windsurfing', 'Wrestling',
  'Wushu', 'Yoga', 'Yachting', 'Yogasana'
];
const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try { const r = await API.get('/me/'); setUser(r.data); }
    catch { setUser(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { localStorage.getItem('athlenet_access') ? refresh() : setLoading(false); }, []);
  const login = async (data) => {
    const r = await API.post('/auth/login/', data);
    localStorage.setItem('athlenet_access', r.data.access);
    localStorage.setItem('athlenet_refresh', r.data.refresh);
    await refresh();
  };
  const register = async (data) => {
    const r = await API.post('/auth/register/', data);
    localStorage.setItem('athlenet_access', r.data.access);
    localStorage.setItem('athlenet_refresh', r.data.refresh);
    await refresh();
  };
  const logout = () => { localStorage.clear(); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</AuthContext.Provider>;
}

const mediaUrl = (src) => src ? new URL(src, API_ORIGIN).href : '';

function Loader() { return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" /></div>; }
function Avatar({ src, name = 'User', size = 'h-10 w-10' }) { return src ? <img src={mediaUrl(src)} className={`${size} rounded-full object-cover`} /> : <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-black text-orange-600`}>{name?.charAt(0)?.toUpperCase()}</div>; }
function IconButton({ to, icon: I, label, badge }) { return <Link to={to} aria-label={label} title={label} className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-orange-50 hover:text-orange-600"><I size={20}/>{badge > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-orange-500 px-1 text-center text-[9px] font-black text-white">{badge}</span>}</Link>; }
function Empty({ title, text, action, to }) { return <div className="card flex min-h-40 flex-col items-center justify-center p-8 text-center"><div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400"><Search size={20}/></div><h3 className="font-bold text-slate-800">{title || 'Nothing here yet'}</h3><p className="mt-1 max-w-md text-sm text-slate-500">{text || ''}</p>{action && to && <Link to={to} className="btn-primary mt-4">{action}</Link>}</div>; }
function InlineError({ message, onRetry }) { return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><div className="flex flex-wrap items-center justify-between gap-3"><p>{message}</p>{onRetry && <button onClick={onRetry} className="rounded-lg border border-red-200 bg-white px-3 py-2 font-bold hover:bg-red-100">Try again</button>}</div></div>; }
function PageHead({ icon: I, title, sub, action, onAction }) { return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-3"><div className="rounded-xl bg-orange-100 p-2.5 text-orange-600"><I size={22}/></div><h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1></div><p className="text-sm text-slate-500">{sub}</p></div>{action && <button onClick={onAction} className="btn-primary shrink-0"><Plus size={18}/>{action}</button>}</div>; }
function SectionTitle({ title, icon: I, action, to }) { return <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><I size={19} className="text-orange-500"/><h2 className="text-xl font-black">{title}</h2></div>{action && to && <Link to={to} className="text-sm font-bold text-orange-600 hover:underline">{action} →</Link>}</div>; }

function PublicHome() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const landingRef = useRef(null);
  useEffect(() => {
    if (loading || user || !landingRef.current) return;
    const root = landingRef.current;
    const targets = root.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach(target => target.classList.add('is-visible'));
      return;
    }
    root.dataset.revealReady = 'true';
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
    targets.forEach(target => observer.observe(target));
    return () => {
      observer.disconnect();
      delete root.dataset.revealReady;
    };
  }, [loading, user]);
  if (loading) return <Loader/>;
  if (user) return <Layout/>;
  if (location.pathname !== '/') return <Navigate to="/login" replace/>;
  return <div className="landing-shell" ref={landingRef}>
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <Link to="/" className="landing-brand" aria-label="Athlenet home">
          <img className="landing-brand-mark" src="/athlenet-nav-mark.png" alt="Athlenet trophy" />
          <img className="landing-brand-wordmark" src="/athlenet-nav-wordmark.png" alt="Athlenet" />
        </Link>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-login">Log in</Link>
          <Link to="/register" className="landing-join">Join Athlenet <ArrowUpRight size={16}/></Link>
        </div>
      </div>
    </header>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy" data-reveal="left">
          <div className="landing-eyebrow"><span className="landing-live-dot"/> YOUR GAME. YOUR NEXT MOVE.</div>
          <h1>Where sport<br/>meets <span>opportunity.</span></h1>
          <p className="landing-hero-text">The network built for the people who make sport matter. Find your next opportunity, meet your people and make every moment count.</p>
          <div className="landing-hero-actions">
            <Link to="/register" className="landing-primary">Find your next move <ArrowUpRight size={18}/></Link>
            <a href="#platform" className="landing-secondary"><span className="landing-play"><ChevronRight size={16}/></span> Explore the network</a>
          </div>
          <div className="landing-social-proof">
            <div className="landing-avatar-stack" aria-hidden="true"><span>R</span><span>A</span><span>M</span><span>+</span></div>
            <div><div className="landing-stars"><ShieldCheck/><span>BUILT FOR EVERY ROLE IN SPORT</span></div><p>Players · Coaches · Communities</p></div>
          </div>
        </div>
        <div className="landing-hero-art" data-reveal="right">
          <div className="landing-photo-wrap">
            <img className="landing-photo" src="https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1200&q=85" alt="Cricket ground ready for the next game"/>
            <div className="landing-photo-shade"/>
            <div className="landing-photo-caption"><span>BUILT AROUND YOUR AMBITION</span><strong>Every great season<br/>starts somewhere.</strong></div>
          </div>
          <div className="landing-float-card landing-opportunity-float"><div className="landing-float-icon"><Target size={20}/></div><div><small>NEW OPPORTUNITIES</small><strong>Your next big break is out there.</strong></div><ArrowUpRight size={18}/></div>
          <div className="landing-float-card landing-community-float"><div className="landing-community-icon"><Activity size={19}/></div><div><strong>Find your people.</strong><small>Coaches · Players · Teams</small></div></div>
          <span className="landing-spark landing-spark-one">✳</span><span className="landing-spark landing-spark-two">✳</span>
        </div>
      </section>

      <section className="landing-trust" aria-label="Athlenet benefits" data-reveal>
        <span>ONE NETWORK. EVERY POSSIBILITY.</span>
        <div><span><ShieldCheck/> Verified opportunities</span><span><Users/> A community that gets it</span><span><Trophy/> Room to grow</span></div>
      </section>

      <section className="landing-platform" id="platform">
        <div className="landing-section-intro" data-reveal><div className="landing-eyebrow landing-eyebrow-dark">MORE THAN A SCOREBOARD</div><h2>Your sporting life,<br/><span>all in one place.</span></h2><p>Less searching. More doing. Athlenet brings your goals and the people who can help you reach them together.</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card landing-feature-dark" data-reveal><div className="landing-feature-icon"><Target/></div><span>01 / FIND YOUR SHOT</span><h3>Opportunities<br/>that move you forward.</h3><p>Discover trials, camps and player selections that match your sport and ambition.</p><Link to="/register" aria-label="Explore sports opportunities"><ArrowUpRight/></Link></article>
          <article className="landing-feature-card" data-reveal><div className="landing-feature-icon"><Users/></div><span>02 / MEET YOUR PEOPLE</span><h3>Great things happen<br/>on the same team.</h3><p>Connect with coaches, players and the wider community that shares your drive.</p><Link to="/register" aria-label="Connect with the sports community"><ArrowUpRight/></Link></article>
          <article className="landing-feature-card landing-feature-lime" data-reveal><div className="landing-feature-icon"><Award/></div><span>03 / MAKE IT COUNT</span><h3>Your journey deserves<br/>to be seen.</h3><p>Build your sports profile, share achievements and put your progress in motion.</p><Link to="/register" aria-label="Build your sports profile"><ArrowUpRight/></Link></article>
        </div>
      </section>

      <section className="landing-quote" id="how-it-works" data-reveal>
        <div className="landing-quote-mark">“</div><div><p>Talent gets you started. The right people and opportunities help you go further.</p><span>YOUR NEXT CHAPTER STARTS HERE</span></div><Link to="/register" className="landing-quote-link">Make your move <ArrowUpRight/></Link>
      </section>

      <section className="landing-bottom" id="community">
        <div className="landing-bottom-copy" data-reveal="left"><div className="landing-eyebrow"><span className="landing-live-dot"/> YOUR NEXT CHAPTER STARTS HERE</div><h2>Big goals.<br/><span>Good people.</span><br/>One place.</h2><p>Whether you’re just starting out or coaching the next generation, there’s a place for you on Athlenet.</p><Link to="/register" className="landing-primary">Join the community <ArrowUpRight size={18}/></Link></div>
        <div className="landing-bottom-card" data-reveal="right"><div className="landing-card-top"><span className="landing-card-tag"><Sparkles size={14}/> THE ATHLENET WAY</span><span className="landing-card-mark">A.</span></div><div className="landing-card-lines"><span>PLAY WITH PURPOSE.</span><span>CONNECT WITH PEOPLE.</span><span className="landing-card-highlight">GROW WITHOUT LIMITS.</span></div><div className="landing-card-footer"><span>ATHLENET COMMUNITY</span><Globe2 size={18}/></div></div>
      </section>
    </main>
    <footer className="landing-footer"><Link to="/" className="landing-brand" aria-label="Athlenet home"><img className="landing-brand-mark" src="/athlenet-nav-mark.png" alt=""/><img className="landing-brand-wordmark" src="/athlenet-nav-wordmark.png" alt="Athlenet"/></Link><span>Play. Connect. Grow.</span><div><Link to="/login">Log in</Link><Link to="/register">Create account <ArrowUpRight size={14}/></Link></div></footer>
  </div>;
}

function Layout() {
  const { user, logout, refresh } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const mainRef = useRef(null);
  const [mobile, setMobile] = useState(false); const [q, setQ] = useState('');
  const [notifications, setNotifications] = useState(0);
  useEffect(() => { API.get('/notifications/').then(r => setNotifications(r.data.filter(n => !n.read).length)).catch(() => {}); }, [loc.pathname]);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const selector = ':scope > .page-wide > *, .page-wide .card, .page-wide article';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let observer;
    const reveal = element => {
      if (!(element instanceof HTMLElement) || element.hasAttribute('data-scroll-reveal')) return;
      element.setAttribute('data-scroll-reveal', '');
      if (!reducedMotion && observer) observer.observe(element);
      else element.classList.add('is-visible');
    };
    const scan = root => {
      if (root instanceof HTMLElement && root.matches(selector)) reveal(root);
      root.querySelectorAll?.(selector).forEach(reveal);
    };
    main.setAttribute('data-scroll-reveal-ready', 'true');
    if (!reducedMotion && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    }
    scan(main);
    const mutations = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof HTMLElement) scan(node);
      }));
    });
    mutations.observe(main, { childList: true, subtree: true });
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      main.removeAttribute('data-scroll-reveal-ready');
    };
  }, [loc.pathname]);
  const doSearch = () => { const value = q.trim(); if (value) nav(`/search?q=${encodeURIComponent(value)}`); };
  const items = [['/','Home',Home],['/opportunities','Opportunities',Target],['/connections','Connections',UserPlus],['/create','Create Post',Plus],['/news','Local Hub',Users],['/profile','Profile',CircleUserRound]];
  const topNavItems = [['/','Home',Home],['/news','Local Hub',Users],['/connections','Connections',UserPlus],['/opportunities','Opportunities',Target],['/create','Create',Plus],['/chat','Messaging',MessageCircle],['/notifications','Notifications',Bell]];
  const displayName = user?.user?.name || user?.user?.username || 'athlete';
  const profileDetails = user?.player_details || user?.coach_details;
  const sportsInterests = user?.interests?.split(',').map(interest=>interest.trim()).filter(Boolean) || [];
  const completionItems = [user?.photo, user?.bio, user?.location, user?.role==='user' ? user?.interests : profileDetails?.sport];
  const profileCompletion = Math.round(completionItems.filter(Boolean).length / completionItems.length * 100);
  return <div className="signed-in-app min-h-screen bg-[#f5f7fb]">
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-[76px] w-full items-center gap-4 px-4 sm:px-6 xl:px-8">
        <button className="rounded-xl p-2 lg:hidden" onClick={() => setMobile(v => !v)}>{mobile ? <X/> : <Menu/>}</button>
        <Link to="/" aria-label="Athlenet home" className="flex shrink-0 items-center gap-2">
          <img src="/athlenet-nav-mark.png" alt="" className="h-10 w-10 object-contain"/>
          <img src="/athlenet-nav-wordmark.png" alt="Athlenet" className="w-[90px] object-contain sm:w-[128px]"/>
        </Link>
        <div className="ml-2 hidden min-w-0 flex-1 xl:flex"><div className="relative flex w-full max-w-[300px] items-center"><Search className="absolute left-3 h-5 w-5 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Search Athlenet" className="input h-10 pl-10 pr-20"/><button onClick={doSearch} className="absolute right-1.5 top-1.5 h-7 rounded-lg bg-orange-500 px-3 text-xs font-bold text-white hover:bg-orange-600">Search</button></div></div>
        <nav aria-label="Main navigation" className="ml-auto hidden h-full items-stretch lg:flex">
          {topNavItems.map(([to,label,I])=><Link key={to} to={to} aria-current={loc.pathname===to?'page':undefined} className={`relative flex min-w-[68px] flex-col items-center justify-center gap-1 px-2 text-[10px] font-semibold transition hover:text-orange-600 xl:min-w-[76px] xl:px-3 xl:text-[11px] ${loc.pathname===to?'text-orange-600 after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-orange-500':'text-slate-500'}`}>
            <span className="relative"><I size={20}/>{to==='/notifications'&&notifications>0&&<span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-orange-500 px-1 text-center text-[9px] font-black text-white">{notifications}</span>}</span>
            <span>{label}</span>
          </Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <div className="flex items-center gap-1 lg:hidden"><IconButton to="/notifications" icon={Bell} label="Notifications" badge={notifications}/><IconButton to="/chat" icon={MessageCircle} label="Messages"/></div>
          <Link to="/profile" aria-label="View your profile" aria-current={loc.pathname==='/profile'?'page':undefined} title={displayName} className={`relative flex items-center gap-2 rounded-full px-1.5 py-1.5 transition hover:bg-slate-100 sm:px-2 ${loc.pathname==='/profile'?'text-orange-600 after:absolute after:inset-x-1 after:bottom-[-16px] after:h-[3px] after:rounded-t-full after:bg-orange-500':'text-slate-600'}`}><Avatar src={user?.photo} name={displayName} size="h-8 w-8"/><span className="hidden max-w-24 truncate text-xs font-bold xl:block">Me</span></Link>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><LogOut size={18}/></button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-2 xl:hidden"><div className="relative"><Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Search players, coaches, sports..." className="input h-10 pl-10 pr-20"/><button onClick={doSearch} className="absolute right-1 top-1 h-8 rounded-lg bg-orange-500 px-3 text-xs font-bold text-white">Search</button></div></div>
    </header>
    <div className="flex w-full">
      <aside className={`${mobile?'translate-x-0':'-translate-x-full'} fixed inset-y-[76px] left-0 z-40 w-72 overflow-y-auto border-r border-slate-200 bg-white p-4 transition-transform lg:sticky lg:top-[76px] lg:h-[calc(100vh-76px)] lg:w-64 lg:translate-x-0 lg:shrink-0`}>
        <section className="card mb-5 overflow-hidden">
          <div className="h-10 bg-gradient-to-r from-slate-950 via-slate-800 to-orange-500"/>
          <div className="px-4 pb-4">
            <Link to="/profile" onClick={()=>setMobile(false)} className="-mt-6 block w-fit rounded-full border-4 border-white"><Avatar src={user?.photo} name={displayName} size="h-12 w-12"/></Link>
            <Link to="/profile" onClick={()=>setMobile(false)} className="mt-2 block truncate text-sm font-black text-slate-900 hover:text-orange-600">{displayName}</Link>
            <p className="mt-1 truncate text-[11px] capitalize text-slate-500">{profileDetails?.sport ? `${profileDetails.sport} · ` : ''}{user?.role || 'Community member'}</p>
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400"><MapPin size={12}/>{user?.pincode ? `PIN ${user.pincode}` : user?.location || 'Add your PIN code'}</p>
            <div className="mt-3 grid grid-cols-2 border-t border-slate-100 pt-3 text-center">
              <Link to="/followers" onClick={()=>setMobile(false)} className="rounded-lg hover:bg-orange-50"><strong className="block text-xs text-slate-800">{user?.followers_count || 0}</strong><span className="text-[10px] text-slate-500">Followers</span></Link>
              <Link to="/connections" onClick={()=>setMobile(false)} className="border-l border-slate-100 rounded-lg hover:bg-orange-50"><strong className="block text-xs text-slate-800">{user?.following_count || 0}</strong><span className="text-[10px] text-slate-500">Following</span></Link>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between"><h2 className="text-[11px] font-black">Profile strength</h2><span className="text-[11px] font-black text-orange-600">{profileCompletion}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500 transition-all" style={{width:`${profileCompletion}%`}}/></div>
              <Link to="/profile" onClick={()=>setMobile(false)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600">Improve profile <ChevronRight size={13}/></Link>
            </div>
          </div>
        </section>
        {user?.role==='user' ? <SportsInterestsCard interests={sportsInterests} onSaved={refresh}/> : <section className="card mb-4 p-4">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Your sports profile</h2>
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2.5"><Trophy size={15} className="mt-0.5 shrink-0 text-orange-500"/><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sport</p><p className="truncate text-xs font-bold text-slate-700">{profileDetails?.sport || 'Add your sport'}</p></div></div>
            {profileDetails?.level&&<div className="flex items-start gap-2.5"><Activity size={15} className="mt-0.5 shrink-0 text-orange-500"/><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Level</p><p className="truncate text-xs font-bold text-slate-700">{profileDetails.level}</p></div></div>}
            {profileDetails?.academy&&<div className="flex items-start gap-2.5"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-orange-500"/><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Academy</p><p className="truncate text-xs font-bold text-slate-700">{profileDetails.academy}</p></div></div>}
            {profileDetails?.verified&&<div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700"><ShieldCheck size={14}/>Verified coach</div>}
          </div>
        </section>}
        {profileDetails?.achievements?.length>0&&<section className="card mb-4 p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Recent achievement</h2><Award size={15} className="shrink-0 text-orange-500"/></div>
          {profileDetails.achievements.slice(0,2).map(achievement=><div key={achievement.id} className="mt-3 border-t border-slate-100 pt-3 first:mt-3"><p className="text-xs font-bold leading-5 text-slate-800">{achievement.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{achievement.year || 'Achievement'}</p></div>)}
          <Link to="/profile" onClick={()=>setMobile(false)} className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600">View portfolio <ChevronRight size={13}/></Link>
        </section>}
        <section className="card mb-4 p-4">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Quick actions</h2>
          <div className="mt-2 space-y-1">
            <Link to="/create" onClick={()=>setMobile(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"><Plus size={15} className="text-orange-500"/>Share an update</Link>
            {user?.role!=='user'&&<Link to="/profile" onClick={()=>setMobile(false)} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"><Edit3 size={15} className="text-orange-500"/>Edit sports profile</Link>}
          </div>
        </section>
        <Link to="/profile" onClick={()=>setMobile(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><Settings size={15}/>Account & profile settings</Link>
      </aside>
      {mobile && <button className="fixed inset-0 top-[76px] z-30 bg-slate-950/20 lg:hidden" onClick={()=>setMobile(false)} aria-label="Close menu"/>}
      <main ref={mainRef} className="min-w-0 flex-1 pb-20 lg:pb-8"><Routes><Route path="/" element={<HomePage/>}/><Route path="/opportunities" element={<Opportunities/>}/><Route path="/connections" element={<Connections/>}/><Route path="/followers" element={<Followers/>}/><Route path="/create" element={<Create/>}/><Route path="/news" element={<News/>}/><Route path="/profile" element={<Profile/>}/><Route path="/profile/:username" element={<PublicProfile/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/chat" element={<Chat/>}/><Route path="/search" element={<SearchPage/>}/><Route path="*" element={<div className="page-wide"><Empty title="Page not found" text="This page does not exist. Use the navigation to continue."/></div>}/></Routes></main>
    </div>
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white lg:hidden"><div className="grid grid-cols-6">{items.map(([to,label,I])=><Link key={to} to={to} className={`flex flex-col items-center py-2 text-[10px] font-black ${loc.pathname===to?'text-orange-500':'text-slate-400'}`}><I size={20}/>{label}</Link>)}</div></nav>
  </div>;
}

function HomePage() {
  const { user } = useAuth(); const [data,setData] = useState({});
  const [loading,setLoading] = useState(true); const [error,setError] = useState('');
  const displayName = user?.user?.name || user?.user?.username || 'athlete';
  const load = async () => { setLoading(true); setError(''); try { const r=await API.get('/dashboard/'); setData(r.data); } catch { setError('Could not load your dashboard. Check that the backend is running, then try again.'); } finally { setLoading(false); } };
  useEffect(() => { load(); },[]);
  const opportunities = data.opportunities || [];
  const news = data.news || [];
  const posts = data.posts || [];
  return <div className="page-wide">
    <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-bold text-orange-600">YOUR SPORTS NETWORK</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Welcome back, {displayName}</h1><p className="mt-1 text-sm text-slate-500">Catch up with your community and find your next opportunity.</p></div>
      <Link to="/opportunities" className="btn-primary"><Target size={17}/>Explore opportunities</Link>
    </section>
    {error ? <InlineError message={error} onRetry={load}/> : loading ? <Loader/> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 space-y-5">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Avatar src={user?.photo} name={displayName} size="h-11 w-11"/>
            <Link to="/create" className="flex min-h-11 flex-1 items-center rounded-full border border-slate-200 px-4 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-slate-50">Share a sports update with your community...</Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {user?.role!=='user'&&<Link to="/create" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-orange-50 hover:text-orange-700"><Award size={17} className="text-orange-500"/>Share an achievement</Link>}
            <Link to="/create" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-orange-50 hover:text-orange-700"><BriefcaseBusiness size={16} className="text-blue-600"/>Post an update</Link>
          </div>
        </div>
        <CommunityFeed currentUserId={user?.user?.id} hasPincode={Boolean(user?.pincode?.trim())} />
      </section>
      <aside className="space-y-5">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black">Opportunities for you</h2><Link to="/opportunities" className="text-xs font-bold text-orange-600 hover:underline">See all</Link></div>
          {opportunities.length ? <div className="mt-3 divide-y divide-slate-100">{opportunities.slice(0,4).map(o=><Link key={o.id} to="/opportunities" className="block py-3 first:pt-1 last:pb-0"><span className="text-[10px] font-bold uppercase tracking-wide text-orange-600">{o.sport}</span><span className="mt-1 block text-sm font-bold leading-5 text-slate-800 hover:text-orange-600">{o.title}</span><span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={12}/>{o.location || 'Location not specified'}</span></Link>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">New trials, camps and selections will show up here.</p>}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black">{user?.pincode ? `Near ${user.pincode}` : user?.location || 'Local'} sports news</h2><Link to="/news" className="text-xs font-bold text-orange-600 hover:underline">Explore</Link></div>
          {news.length ? <div className="mt-3 divide-y divide-slate-100">{news.slice(0,3).map(n=><article key={n.id} className="py-3 first:pt-1 last:pb-0"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{n.sport || 'Sports'}{n.location ? ` · ${n.location}` : ''}</span><h3 className="mt-1 text-sm font-bold leading-5 text-slate-800">{n.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{n.summary}</p></article>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Sports updates from your area will appear here.</p>}
        </section>
        <section className="rounded-2xl bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2 text-orange-400"><ShieldCheck size={18}/><h2 className="text-sm font-black text-white">Make your next move</h2></div>
          <p className="mt-2 text-xs leading-5 text-slate-300">Keep your sports identity up to date and be ready when the right opportunity comes along.</p>
          <Link to="/profile" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-orange-300 hover:text-white">Build your profile <ChevronRight size={14}/></Link>
        </section>
      </aside>
    </div>}
  </div>;
}

function SportsInterestsCard({interests,onSaved}) {
  const [value,setValue]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const save=async nextInterests=>{
    setBusy(true);
    setError('');
    try {
      await API.patch('/me/',{interests:nextInterests.join(', ')});
      await onSaved();
      return true;
    } catch (e) {
      setError(e.response?.data?.detail||'Unable to update sports interests. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add=async e=>{
    e.preventDefault();
    const interest=value.trim();
    if(!interest||interests.some(item=>item.toLowerCase()===interest.toLowerCase()))return;
    if(await save([...interests,interest]))setValue('');
  };
  const remove=interest=>save(interests.filter(item=>item!==interest));
  return <section className="card mb-4 p-4">
    <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Your sports interests</h2>
    {interests.length ? <div className="mt-3 flex flex-wrap gap-2">{interests.map(interest=><span key={interest} className="inline-flex items-center gap-1 rounded-full bg-orange-50 py-1 pl-3 pr-1 text-xs font-semibold text-orange-700">{interest}<button type="button" onClick={()=>remove(interest)} disabled={busy} aria-label={`Remove ${interest}`} className="rounded-full p-1 hover:bg-orange-100 disabled:opacity-50"><X size={12}/></button></span>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Add the sports you enjoy to see more relevant community updates.</p>}
    <form onSubmit={add} className="mt-3 flex gap-2">
      <select value={value} onChange={e=>setValue(e.target.value)} aria-label="Choose a sports interest" className="input min-w-0 flex-1 py-2 text-xs">
        <option value="">Select a sport</option>
        {SPORTS.map(sport=><option key={sport} value={sport}>{sport}</option>)}
      </select>
      <button type="submit" disabled={busy||!value} className="btn-primary px-3 py-2 text-xs"><Plus size={14}/>Add</button>
    </form>
    {error&&<p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
  </section>;
}

function OpportunityCard({o}) {
  const {user}=useAuth(); const [done,setDone]=useState(o.applied); const [busy,setBusy]=useState(false);
  const apply=async()=>{setBusy(true);try{await API.post(`/opportunities/${o.id}/`,{message:'Interested in this opportunity.'});setDone(true);alert('Application submitted successfully.')}catch(e){alert(e.response?.data?.detail||'Unable to apply.')}finally{setBusy(false)}};
  return <div className="card flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between"><span className="pill">{o.sport}</span>{o.coach_verified&&<span title="Verified coach" className="text-blue-500"><ShieldCheck size={18}/></span>}</div><h3 className="mt-4 text-lg font-black">{o.title}</h3><p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500">{o.description}</p><div className="mt-4 space-y-2 text-xs text-slate-500"><div className="flex gap-2"><MapPin size={15}/>{o.location}</div><div className="flex gap-2"><CalendarDays size={15}/>Event: {o.event_date}</div><div className="flex gap-2"><Clock3 size={15}/>Apply by: {o.last_date}</div><div className="flex gap-2"><Users size={15}/>{o.application_count || 0} applications · {o.slots} slots</div></div><div className="mt-auto flex items-center justify-between gap-3 pt-5"><span className="text-xs font-semibold text-slate-400">By {o.coach_name}</span>{user?.role==='player' ? <button onClick={apply} disabled={done||busy} className={done?'btn-ghost':'btn-primary'}>{done?<><Check size={16}/>Applied</>:busy?'Applying...':'Apply now'}</button> : <span className="text-xs font-bold text-slate-400">Players can apply</span>}</div></div>;
}

function Opportunities() {
  const {user}=useAuth(); const [items,setItems]=useState([]); const [sport,setSport]=useState(''); const [location,setLocation]=useState(''); const [q,setQ]=useState(''); const [open,setOpen]=useState(false); const [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);try{const r=await API.get('/opportunities/',{params:{sport,location,q}});setItems(r.data)}catch(e){alert('Could not load opportunities. Check that Django is running.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  return <div className="page-wide"><PageHead icon={Target} title="Sports opportunities" sub="Find verified trials, camps, selections and recruitment opportunities." action={user?.role==='coach'?'Create opportunity':undefined} onAction={()=>setOpen(true)}/>
    <div className="card mb-7 p-4"><div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><input className="input pl-10" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Search opportunities..."/></div><input className="input" value={sport} onChange={e=>setSport(e.target.value)} placeholder="Sport e.g. Cricket"/><input className="input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location e.g. Hyderabad"/><button onClick={load} className="btn-primary"><Search size={18}/>Search</button></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Filter size={15}/><button onClick={()=>{setSport('');setLocation('');setQ('');setTimeout(load,0)}} className="font-bold text-orange-600">Clear filters</button><span>•</span><span>{items.length} result{items.length===1?'':'s'}</span></div></div>
    {loading?<Loader/>:<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{items.map(o=><OpportunityCard key={o.id} o={o}/>)}</div>}{!loading&&!items.length&&<Empty title="No matching opportunities" text="Try another sport, location or keyword. Coaches can publish opportunities from this page."/>}
    {user?.role!=='coach'&&<div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800"><b>Want to post an opportunity?</b> Create a Coach account to publish trials, camps and selections.</div>}
    {open&&<OpportunityModal onClose={()=>setOpen(false)} onCreated={()=>{setOpen(false);load()}}/>}
  </div>;
}
function OpportunityModal({onClose,onCreated}){const [d,setD]=useState({sport:'Cricket'});const [busy,setBusy]=useState(false);const set=(k,v)=>setD(x=>({...x,[k]:v}));const submit=async e=>{e.preventDefault();setBusy(true);try{await API.post('/opportunities/',d);alert('Opportunity created.');onCreated()}catch(e){alert(JSON.stringify(e.response?.data)||'Unable to create opportunity.')}finally{setBusy(false)}};return <Modal title="Create sports opportunity" onClose={onClose}><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><Field label="Title" value={d.title||''} onChange={v=>set('title',v)} required/><Field label="Sport" value={d.sport||''} onChange={v=>set('sport',v)} required/><Field label="Location" value={d.location||''} onChange={v=>set('location',v)} required/><Field label="Slots" type="number" value={d.slots||20} onChange={v=>set('slots',v)} required/><Field label="Event date" type="date" value={d.event_date||''} onChange={v=>set('event_date',v)} required/><Field label="Application deadline" type="date" value={d.last_date||''} onChange={v=>set('last_date',v)} required/><div className="md:col-span-2"><label className="label">Description</label><textarea className="input min-h-28" value={d.description||''} onChange={e=>set('description',e.target.value)} required/></div><div className="md:col-span-2"><label className="label">Eligibility</label><textarea className="input min-h-20" value={d.eligibility||''} onChange={e=>set('eligibility',e.target.value)} placeholder="Age, level, documents, etc."/></div><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={onClose} className="btn-ghost">Cancel</button><button disabled={busy} className="btn-primary">{busy?'Publishing...':'Publish opportunity'}</button></div></form></Modal>}

function Create(){const {user}=useAuth();const [tab,setTab]=useState('post');return <div className="page-wide"><PageHead icon={Plus} title="Create on Athlenet" sub="Share useful sports updates and opportunities — meaningful content only."/><div className="mb-6 flex rounded-2xl bg-slate-200 p-1"><button onClick={()=>setTab('post')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${tab==='post'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Community post</button><button onClick={()=>setTab('opportunity')} className={`flex-1 rounded-xl px-4 py-3 text-sm font-black ${tab==='opportunity'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Opportunity</button></div>{tab==='post'?<PostComposer/>:user?.role==='coach'?<OpportunityModal onClose={()=>setTab('post')} onCreated={()=>setTab('post')}/>:<div className="card p-8 text-center"><ShieldCheck className="mx-auto text-orange-500"/><h2 className="mt-3 text-xl font-black">Coach access required</h2><p className="mt-1 text-sm text-slate-500">Only verified/registered coaches can publish opportunities.</p></div>}</div>}
function PostComposer(){const {user}=useAuth();const generalUser=user?.role==='user';const initialPostType=generalUser?'discussion':'achievement';const [d,setD]=useState(()=>({post_type:initialPostType,content:''}));const [busy,setBusy]=useState(false);const set=(k,v)=>setD(x=>({...x,[k]:v}));const submit=async e=>{e.preventDefault();setBusy(true);try{const fd=new FormData();Object.entries(d).forEach(([k,v])=>v&&fd.append(k,v));await API.post('/posts/',fd);setD({post_type:initialPostType,content:''});alert('Post published successfully.')}catch(e){alert(JSON.stringify(e.response?.data)||'Unable to publish post.')}finally{setBusy(false)}};const postTypes=[['achievement','Achievement'],['camp','Training Camp'],['trial','Trial'],['recruitment','Recruitment'],['discussion','Discussion'],['awareness','Awareness']];return <form onSubmit={submit} className="card p-5 sm:p-7"><div className="grid gap-4 md:grid-cols-[260px_1fr]"><div><label className="label">Post type</label><select className="input" value={d.post_type} onChange={e=>set('post_type',e.target.value)}>{postTypes.filter(([type])=>!generalUser||type!=='achievement').map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></div><div><label className="label">What would you like to share?</label><textarea className="input min-h-32" value={d.content} onChange={e=>set('content',e.target.value)} placeholder="Share a useful sports update, event information, or start a discussion..." required/></div><div className="md:col-span-2"><label className="label">Image (optional)</label><input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>5*1024*1024){alert('Files must not exceed 5 MB.');e.target.value='';return}set('image',file)}} className="block w-full rounded-xl border border-slate-200 p-3 text-sm"/></div></div><button disabled={busy} className="btn-primary mt-5 w-full">{busy?'Publishing...':'Publish post'}</button></form>}

function PostCard({p,onDeleted}){const {user}=useAuth();return <article className="card overflow-hidden"><div className="flex items-center gap-3 p-5"><Avatar src={p.author?.photo} name={p.author?.name}/><div className="min-w-0"><Link to={`/profile/${p.author?.username}`} className="font-black hover:text-orange-600">{p.author?.name}</Link><div className="text-xs text-slate-400">{p.post_type} · {new Date(p.created_at).toLocaleDateString()}</div></div></div>{p.image&&<img src={mediaUrl(p.image)} className="max-h-80 w-full object-cover" alt=""/>}<p className="px-5 pb-4 text-sm leading-6 text-slate-700">{p.content}</p><PostActions post={p} currentUserId={user?.user?.id} onDeleted={onDeleted}/></article>}
function Connections(){const [members,setMembers]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const load=async()=>{setLoading(true);setError('');try{const r=await API.get('/connections/');setMembers(r.data)}catch{setError('Could not load the people you follow. Check your connection and try again.')}finally{setLoading(false)}};useEffect(()=>{load()},[]);const updateMember=(id,changes)=>{if(changes.is_following===false)setMembers(items=>items.filter(member=>member.user.id!==id))};return <div className="page-wide"><PageHead icon={UserPlus} title="Following" sub="People you follow on Athlenet."/><div className="mb-4 text-sm text-slate-500">{members.length} following</div>{error?<InlineError message={error} onRetry={load}/>:loading?<Loader/>:members.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{members.map(member=><MemberCard key={member.user.id} member={member} onUpdate={updateMember}/>)}</div>:<Empty title="You're not following anyone yet" text="Visit the Local Hub and connect with players, coaches and community members."/ >}</div>}
function Followers(){const [members,setMembers]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const load=async()=>{setLoading(true);setError('');try{const r=await API.get('/followers/');setMembers(r.data)}catch{setError('Could not load your followers. Check your connection and try again.')}finally{setLoading(false)}};useEffect(()=>{load()},[]);const updateMember=(id,changes)=>{if(changes.is_following===false)setMembers(items=>items.map(member=>member.user.id===id?{...member,...changes}:member))};return <div className="page-wide"><PageHead icon={Users} title="Followers" sub="People who follow you on Athlenet."/><div className="mb-4 text-sm text-slate-500">{members.length} follower{members.length===1?'':'s'}</div>{error?<InlineError message={error} onRetry={load}/>:loading?<Loader/>:members.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{members.map(member=><MemberCard key={member.user.id} member={member} onUpdate={updateMember}/>)}</div>:<Empty title="No followers yet" text="As people connect with you, they will show up here."/ >}</div>}

function NewsCard({n}){return <article className="card overflow-hidden">{n.image&&<img src={mediaUrl(n.image)} className="h-40 w-full object-cover"/>}<div className="p-5"><div className="flex items-center gap-2"><span className="pill">{n.sport||'Sports'}</span>{n.featured&&<span className="text-xs font-bold text-orange-600">Featured</span>}</div><h3 className="mt-3 font-black">{n.title}</h3><p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500">{n.summary}</p><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{n.location||'National'}</span>{n.source_url&&<a href={n.source_url} target="_blank" rel="noreferrer" className="font-bold text-orange-600">Source →</a>}</div></div></article>}

function News(){const {user}=useAuth();return <LocalHub user={user}/>}
function MemberCard({member,onUpdate}){const [following,setFollowing]=useState(member.is_following);const [busy,setBusy]=useState(false);const follow=async()=>{setBusy(true);try{const r=await API.post(`/users/${member.user.username}/follow/`);setFollowing(r.data.following);onUpdate(member.user.id,{is_following:r.data.following,followers_count:member.followers_count+(r.data.following?1:-1)})}catch(e){alert(e.response?.data?.detail||'Unable to update connection.')}finally{setBusy(false)}};return <article className="card flex min-h-56 flex-col p-5"><div className="flex items-start gap-3"><Link to={`/profile/${member.user.username}`}><Avatar src={member.photo||member.user.photo} name={member.user.name} size="h-12 w-12"/></Link><div className="min-w-0 flex-1"><Link to={`/profile/${member.user.username}`} className="block truncate font-black text-slate-900 hover:text-orange-600">{member.user.name}</Link><div className="mt-0.5 text-xs capitalize text-slate-500">{member.role==='user'?'Community member':member.role}</div></div><span className="pill">{member.sport||member.role}</span></div><p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{member.bio||'Part of the Athlenet sports community.'}</p><div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><MapPin size={14}/><span className="truncate">{member.location||'Location not added'}</span><span className="ml-auto shrink-0">{member.followers_count} followers</span></div><div className="mt-auto flex gap-2 pt-4"><button onClick={follow} disabled={busy} className={following?'btn-ghost flex-1':'btn-primary flex-1'}>{following?<Check size={16}/>:<UserPlus size={16}/ >}{busy?'Updating...':following?'Connected':'Connect'}</button><Link to={`/chat?user=${member.user.id}`} aria-label={`Message ${member.user.name}`} title="Message" className="btn-ghost px-3"><MessageCircle size={18}/></Link></div></article>}

function Profile(){const {user,refresh}=useAuth();const [edit,setEdit]=useState(false);return <><ProfileView profile={user} own refresh={refresh} edit={edit} setEdit={setEdit}/><ProfilePosts username={user?.user?.username}/></>}
function ProfilePosts({username,title='Your posts'}){const [posts,setPosts]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const load=async()=>{if(!username)return;setLoading(true);setError('');try{const r=await API.get('/posts/',{params:{author:username}});setPosts(r.data)}catch(e){setError(e.response?.data?.detail||'Could not load posts. Check your connection and try again.')}finally{setLoading(false)}};useEffect(()=>{load()},[username]);return <section className="page-wide pt-0"><h2 className="mb-4 flex items-center gap-2 text-xl font-black"><MessageSquare size={20} className="text-orange-500"/>{title}</h2>{error?<InlineError message={error} onRetry={load}/>:loading?<Loader/>:posts.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{posts.map(post=><PostCard key={post.id} p={post} onDeleted={id=>setPosts(current=>current.filter(item=>item.id!==id))}/>)}</div>:<Empty title="No posts yet" text="Posts shared with the Athlenet community will appear here."/ >}</section>}
function PublicProfile(){const {username}=useParams();const [profile,setProfile]=useState(null);useEffect(()=>{API.get(`/users/${username}/`).then(r=>setProfile(r.data)).catch(()=>setProfile(false))},[username]);if(profile===null)return <Loader/>;if(profile===false)return <div className="page-wide"><Empty title="Profile not found"/></div>;return <><ProfileView profile={profile}/><ProfilePosts username={profile.user.username} title={`${profile.user.name}'s posts`}/></>}
function ProfileView({profile,own,refresh,edit,setEdit}){const {user}=useAuth();const [following,setFollowing]=useState(Boolean(profile?.is_following));const [busy,setBusy]=useState(false);const p=profile?.player_details;const c=profile?.coach_details;useEffect(()=>setFollowing(Boolean(profile?.is_following)),[profile?.user?.username,profile?.is_following]);const follow=async()=>{setBusy(true);try{const r=await API.post(`/users/${profile.user.username}/follow/`);setFollowing(r.data.following)}catch(e){alert(e.response?.data?.detail||'Unable to follow')}finally{setBusy(false)}};return <div className="page-wide"><div className="profile-cover"/><div className="-mt-12 px-5 sm:px-8"><div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end"><Avatar src={profile.photo} name={profile.user?.name} size="h-24 w-24 border-4 border-white shadow-lg"/><div><h1 className="text-2xl font-black">{profile.user?.name}</h1><p className="text-sm text-slate-500">{own&&profile.email?profile.email:`@${profile.user?.username}`} · <span className="font-bold capitalize">{profile.role}</span></p><div className="mt-3 flex flex-wrap gap-4 text-sm"><span><b>{profile.followers_count||0}</b> followers</span><span><b>{profile.following_count||0}</b> following</span>{(own&&profile.pincode)||profile.location ? <span className="flex items-center gap-1 text-slate-500"><MapPin size={15}/>{own&&profile.pincode ? `PIN ${profile.pincode}` : profile.location}</span> : null}</div></div></div>{own?<button onClick={()=>setEdit(true)} className="btn-ghost"><Edit3 size={17}/>Edit profile</button>:<div className="flex gap-2"><button onClick={follow} disabled={busy} className={following?'btn-ghost':'btn-primary'}>{following?<Check size={17}/>:<UserPlus size={17}/ >}{busy?'Updating...':following?'Following':'Follow'}</button><button onClick={async()=>{const r=await API.post('/conversations/',{user_id:profile.user.id});window.location.href=`/chat?conversation=${r.data.id}`}} className="btn-ghost"><MessageCircle size={17}/>Message</button></div>}</div></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><div className="space-y-6"><div className="card p-6"><h2 className="text-lg font-black">About</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{profile.bio||'No bio added yet.'}</p></div>{p&&<div className="card p-6"><h2 className="text-lg font-black">Player portfolio</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Info label="Sport" value={p.sport}/><Info label="Gender" value={p.gender}/><Info label="Level" value={p.level}/><Info label="District" value={p.district}/><Info label="State" value={p.state}/><Info label="Experience" value={`${p.experience||0} years`}/><Info label="Ranking" value={p.ranking}/></div></div>}{c&&<div className="card p-6"><h2 className="text-lg font-black">Coach portfolio</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Info label="Sport" value={c.sport}/><Info label="Experience" value={`${c.experience||0} years`}/><Info label="Academy" value={c.academy}/><Info label="Verification" value={c.verified?'Verified coach':'Pending verification'}/></div></div>}{p?.achievements?.length>0&&<div className="card p-6"><h2 className="text-lg font-black">Achievements</h2><div className="mt-4 space-y-3">{p.achievements.map(a=><div key={a.id} className="rounded-xl border p-4"><div className="font-bold">{a.title}</div><p className="mt-1 text-sm text-slate-500">{a.description}</p><span className="text-xs text-slate-400">{a.year}</span></div>)}</div></div>}</div><div className="space-y-6"><div className="card p-6"><h2 className="text-lg font-black">Sports identity</h2><div className="mt-4 space-y-4"><Info label="Role" value={profile.role}/><Info label="Mobile" value={profile.phone||'Not added'}/><Info label="PIN code" value={own ? profile.pincode||'Not added' : profile.location||'Not added'}/></div></div><div className="card p-6"><h2 className="text-lg font-black">Account</h2><Link to="/notifications" className="mt-3 flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"><Bell size={18} className="text-orange-500"/>Notifications</Link><Link to="/chat" className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"><MessageCircle size={18} className="text-orange-500"/>Messages</Link></div></div></div>{edit&&<ProfileEditor profile={profile} onClose={()=>setEdit(false)} onSaved={refresh}/>} </div>}
function Info({label,value}){return <div><div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 font-bold text-slate-700">{value||'Not added'}</div></div>}

function Notifications(){const [items,setItems]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const load=async()=>{setLoading(true);setError('');try{const r=await API.get('/notifications/');setItems(r.data)}catch{setError('Could not load notifications. Try again.')}finally{setLoading(false)}};useEffect(()=>{load()},[]);const mark=async()=>{try{await API.post('/notifications/');await load()}catch{setError('Could not mark notifications as read. Try again.')}};return <div className="page-wide"><PageHead icon={Bell} title="Notifications" sub="Updates about applications, follows, likes and messages."/><div className="mb-4 flex justify-end"><button onClick={mark} className="btn-ghost" disabled={loading}><Check size={17}/>Mark all as read</button></div>{error?<InlineError message={error} onRetry={load}/>:loading?<Loader/>:<div className="card divide-y">{items.map(n=><div key={n.id} className={`flex items-start gap-4 p-5 ${!n.read?'bg-orange-50/50':''}`}><div className="rounded-full bg-orange-100 p-2 text-orange-600"><Bell size={17}/></div><div className="flex-1"><p className="text-sm font-semibold">{n.message}</p><span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</span></div>{!n.read&&<span className="mt-2 h-2 w-2 rounded-full bg-orange-500"/>}</div>)}{!items.length&&<div className="p-10"><Empty title="You're all caught up" text="New notifications will appear here."/></div>}</div>}</div>}

function Chat(){
  const [convos,setConvos]=useState([]); const [active,setActive]=useState(null); const [messages,setMessages]=useState([]); const [text,setText]=useState(''); const [params]=useSearchParams();
  const load=()=>API.get('/conversations/').then(r=>setConvos(r.data)).catch(()=>{});
  useEffect(()=>{load()},[]);
  useEffect(()=>{const id=params.get('conversation'); if(id) setActive(Number(id));},[params]);
  useEffect(()=>{
    const userId=params.get('user');
    if(userId && !active){API.post('/conversations/',{user_id:Number(userId)}).then(r=>{setActive(r.data.id);load()}).catch(()=>{})}
  },[params,active]);
  useEffect(()=>{if(active) API.get(`/conversations/${active}/messages/`).then(r=>setMessages(r.data)).catch(()=>{})},[active]);
  const send=async()=>{if(!text.trim()||!active)return;try{await API.post(`/conversations/${active}/messages/`,{text:text.trim()});setText('');const r=await API.get(`/conversations/${active}/messages/`);setMessages(r.data);load()}catch(e){alert(e.response?.data?.detail||'Unable to send message')}};
  const current=convos.find(c=>c.id===active);
  return <div className="page-wide"><PageHead icon={MessageCircle} title="Messages" sub="Private conversations between players, coaches and sports members."/><div className="card grid min-h-[620px] overflow-hidden md:grid-cols-[320px_1fr]"><div className="border-r bg-slate-50 p-3">{convos.map(c=><div key={c.id} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${active===c.id?'bg-white shadow-sm':'hover:bg-white'}`}><Link to={`/profile/${c.other_user?.username}`} aria-label={`View ${c.other_user?.name} profile`}><Avatar src={c.other_user?.photo} name={c.other_user?.name}/></Link><button onClick={()=>setActive(c.id)} className="min-w-0 flex-1 text-left"><b className="block truncate">{c.other_user?.name}</b><span className="block truncate text-xs text-slate-400">{c.last_message?.text||'Start a conversation'}</span></button></div>)}{!convos.length&&<div className="p-5 text-center text-sm text-slate-500">No conversations yet. Search for a player or coach and click Message.</div>}</div><div className="flex min-h-[620px] flex-col">{current?<><div className="flex items-center gap-3 border-b p-4"><Link to={`/profile/${current.other_user?.username}`} aria-label={`View ${current.other_user?.name} profile`}><Avatar src={current.other_user?.photo} name={current.other_user?.name}/></Link><div><b>{current.other_user?.name}</b><div className="text-xs text-slate-400">@{current.other_user?.username} · {current.other_user?.role}</div></div></div><div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-5">{messages.map(m=><div key={m.id} className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.sender?.id===current.other_user?.id?'border bg-white text-slate-700':'ml-auto bg-orange-500 text-white'}`}>{m.text}<div className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>)}</div><div className="flex gap-2 border-t bg-white p-3"><input className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Type a message..."/><button onClick={send} className="btn-primary"><Send/></button></div></>:<div className="flex flex-1 items-center justify-center p-8 text-center text-slate-400">Select a conversation or message someone from their profile.</div>}</div></div></div>
}

function SearchPage(){
  const [params]=useSearchParams(); const q=params.get('q')||'';
  const [data,setData]=useState({users:[],opportunities:[],news:[]});
  const [loading,setLoading]=useState(Boolean(q)); const [error,setError]=useState(''); const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!q){setData({users:[],opportunities:[],news:[]});setLoading(false);setError('');return}
    let cancelled=false;
    setLoading(true);setError('');
    API.get('/search/',{params:{q}})
      .then(r=>{if(!cancelled)setData(r.data)})
      .catch(()=>{if(!cancelled)setError('Search could not be completed. Check your connection and try again.')})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[q,retry]);
  return <div className="page-wide"><PageHead icon={Search} title="Search results" sub={q?`Results for “${q}” across players, coaches, opportunities and news.`:'Search for people, opportunities and sports news.'}/>{!q?<Empty title="Start a search" text="Use the search bar above to find people, opportunities and news."/>:error?<InlineError message={error} onRetry={()=>setRetry(value=>value+1)}/>:loading?<Loader/>:<div className="grid gap-6 xl:grid-cols-3"><div className="card p-5"><h2 className="mb-4 text-lg font-black">People</h2>{data.users.map(u=><div key={u.user.id} className="mb-2 flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"><Link to={`/profile/${u.user.username}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar src={u.photo} name={u.user.name}/><div className="min-w-0"><b className="block truncate">{u.user.name}</b><span className="text-xs text-slate-500">@{u.user.username}</span></div></Link><Link to={`/chat?user=${u.user.id}`} className="rounded-lg p-2 text-orange-600 hover:bg-orange-50"><MessageCircle size={17}/></Link></div>)}{!data.users.length&&<p className="text-sm text-slate-500">No people found.</p>}</div><div className="card p-5"><h2 className="mb-4 text-lg font-black">Opportunities</h2>{data.opportunities.map(o=><Link key={o.id} to="/opportunities" className="mb-3 block rounded-xl border p-4 hover:border-orange-300"><span className="pill">{o.sport}</span><b className="mt-2 block">{o.title}</b><span className="text-xs text-slate-500">{o.location} · {o.event_date}</span></Link>)}{!data.opportunities.length&&<p className="text-sm text-slate-500">No opportunities found.</p>}</div><div className="card p-5"><h2 className="mb-4 text-lg font-black">News</h2>{(data.news||[]).map(n=><div key={n.id} className="mb-3 rounded-xl border p-4"><span className="pill">{n.sport||'Sports'}</span><b className="mt-2 block">{n.title}</b><span className="text-xs text-slate-500">{n.location||'National'}</span></div>)}{!data.news?.length&&<p className="text-sm text-slate-500">No news found.</p>}</div></div>}</div>
}

function Modal({title,onClose,children}){return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X/></button></div>{children}</div></div>}
function isValidMobile(value){let digits=String(value).replace(/\D/g,'');if(digits.length===12&&digits.startsWith('91'))digits=digits.slice(2);return /^[6-9]\d{9}$/.test(digits)&&[...digits].every(digit=>[...digits].filter(item=>item===digit).length<=6)}
function PasswordStrength({password}){const checks=[['At least 8 characters',password.length>=8],['An uppercase letter',/[A-Z]/.test(password)],['A lowercase letter',/[a-z]/.test(password)],['A special character',/[^A-Za-z0-9]/.test(password)]];const score=checks.filter(([,passed])=>passed).length;const labels=['Very weak','Weak','Fair','Good','Strong'];const color=score<2?'bg-red-500':score<3?'bg-amber-500':score<4?'bg-lime-500':'bg-emerald-500';return <div className="mt-2" aria-live="polite"><div className="flex justify-between text-xs"><span className="text-slate-500">Password strength</span><span className="font-semibold text-slate-700">{password?labels[score]:'Not set'}</span></div><div role="progressbar" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full transition-all ${color}`} style={{width:`${score*25}%`}}/></div><ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">{checks.map(([label,passed])=><li key={label} className={passed?'font-semibold text-emerald-700':'text-slate-500'}>{passed?'✓':'•'} {label}</li>)}</ul></div>}

function Field({label,type='text',value,onChange,required,defaultValue,name,inputMode,pattern,maxLength,minLength,helperText}){const location=useLocation();const [passwordVisible,setPasswordVisible]=useState(false);const isPassword=type==='password';const registrationPassword=isPassword&&location.pathname==='/register';const isState=label==='State';return <div><label className="label" htmlFor={isState?'registration-state':undefined}>{label}</label>{isState?<select id="registration-state" value={value||''} onChange={e=>onChange&&onChange(e.target.value)} className="input"><option value="">Select a state or union territory</option>{INDIAN_STATES_AND_UTS.map(state=><option key={state} value={state}>{state}</option>)}</select>:<><div className={isPassword?'relative':''}><input name={name} type={isPassword&&passwordVisible?'text':type} value={value} defaultValue={defaultValue} onChange={e=>onChange&&onChange(e.target.value)} required={required} inputMode={inputMode} pattern={registrationPassword?'(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}':pattern} minLength={registrationPassword?8:minLength} maxLength={maxLength} aria-describedby={helperText?`${name||label}-help`:undefined} className={`input ${isPassword?'pr-12':''}`}/>{isPassword&&<button type="button" onClick={()=>setPasswordVisible(visible=>!visible)} aria-label={passwordVisible?'Hide password':'Show password'} aria-pressed={passwordVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400">{passwordVisible?<EyeOff size={18}/>:<Eye size={18}/>}</button>}</div>{helperText&&<p id={`${name||label}-help`} className="mt-1.5 text-xs text-slate-500">{helperText}</p>}{registrationPassword&&<PasswordStrength password={value||''}/>}</>}</div>}

function AuthPage({register=false}){const {login,register:reg}=useAuth();const nav=useNavigate();const [role,setRole]=useState('player');const [d,setD]=useState({});const [busy,setBusy]=useState(false);const set=(k,v)=>setD(x=>({...x,[k]:v}));const submit=async e=>{e.preventDefault();setBusy(true);try{if(register){const fd=new FormData();Object.entries(d).forEach(([k,v])=>{if(k==='other_sport')return;if(k==='sport'&&v==='Other')v=d.other_sport;if(v!==undefined&&v!==null&&v!=='')fd.append(k,v)});fd.append('username',(d.email||'').trim().toLowerCase());fd.append('role',role);await reg(fd)}else await login({username:d.username,password:d.password});nav('/')}catch(e){alert(e.response?.data?.detail||JSON.stringify(e.response?.data)||'Unable to continue')}finally{setBusy(false)}};return <div className="flex min-h-screen bg-slate-100"><div className="hidden w-1/2 items-center justify-center bg-gradient-to-br from-orange-50 via-white to-sky-50 p-12 lg:flex"><div className="max-w-xl text-slate-900"><div className="mb-10 flex items-center gap-4"><img src="/athlenet-nav-mark.png" alt="Athlenet mark" className="h-16 w-16 object-contain"/><img src="/athlenet-nav-wordmark.png" alt="Athlenet" className="h-12 w-48 object-contain"/></div><div className="text-5xl font-black">Play. Connect.<br/><span className="text-orange-600">Grow.</span></div><p className="mt-5 max-w-lg text-slate-600">A professional sports network for players, coaches and sports communities.</p><div className="mt-8 grid grid-cols-3 gap-3 text-sm"><div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><span className="text-slate-500">Verified</span><br/><b className="text-slate-900">Coaches</b></div><div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><span className="text-slate-500">Sports</span><br/><b className="text-slate-900">Opportunities</b></div><div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><span className="text-slate-500">Local</span><br/><b className="text-slate-900">News</b></div></div></div></div><div className="flex w-full items-center justify-center bg-white p-5 sm:p-10 lg:w-1/2"><form onSubmit={submit} className="w-full max-w-2xl"><div className="mb-6 lg:hidden"><img src="/athlenet-logo.jpeg" className="h-20 w-28 object-contain"/></div><h1 className="text-3xl font-black">{register?'Create your Athlenet account':'Welcome back'}</h1><p className="mt-2 text-sm text-slate-500">{register?'Choose your role and build your sports identity.':'Sign in to continue to your sports network.'}</p>{register&&<div className="mt-6 grid grid-cols-3 gap-2">{[['player','Player'],['coach','Coach'],['user','General User']].map(([v,l])=><button type="button" key={v} onClick={()=>setRole(v)} className={`rounded-xl border p-3 text-sm font-bold ${role===v?'border-orange-400 bg-orange-50 text-orange-700':'border-slate-200'}`}>{l}</button>)}</div>}<div className="mt-6 grid gap-4 md:grid-cols-2">{register&&<><Field label="First name" value={d.first_name||''} onChange={v=>set('first_name',v)} required/><Field label="Last name" value={d.last_name||''} onChange={v=>set('last_name',v)} required/><Field label="Email address" type="email" value={d.email||''} onChange={v=>set('email',v)} required/></>}{!register&&<Field label="Email or username" value={d.username||''} onChange={v=>set('username',v)} required/>}<Field label="Password" type="password" value={d.password||''} onChange={v=>set('password',v)} required/>{register&&<><div><label className="label" htmlFor="marital-status">Marital status</label><select id="marital-status" value={d.marital_status||''} onChange={e=>set('marital_status',e.target.value)} required className="input"><option value="">Select marital status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option><option value="Prefer not to share">Prefer not to share</option></select></div>{(role==='player'||role==='user')&&<div><label className="label" htmlFor="registration-gender">Gender</label><select id="registration-gender" value={d.gender||''} onChange={e=>set('gender',e.target.value)} required className="input"><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select></div>}</>}{register&&<><div><label className="label" htmlFor="registration-mobile">Mobile number</label><input id="registration-mobile" name="phone" type="tel" value={d.phone||''} onChange={e=>{const digits=e.target.value.replace(/\D/g,'').slice(0,10);const value=digits&&!/[6-9]/.test(digits[0])?'':digits;set('phone',value);e.target.setCustomValidity([...value].some(digit=>value.split(digit).length-1>6)?'A digit may appear at most 6 times.':'')}} required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} title="Enter 10 digits starting with 6, 7, 8, or 9. No digit may appear more than 6 times." className="input"/></div><Field label="PIN code (India)" name="pincode" value={d.pincode||''} onChange={v=>set('pincode',v.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required helperText="Enter a 6-digit Indian PIN code for local sports updates."/>{(role==='coach'||role==='player')&&<><div><label className="label" htmlFor="date-of-birth">Date of birth</label><input id="date-of-birth" name="date_of_birth" type="date" value={d.date_of_birth||''} onChange={e=>set('date_of_birth',e.target.value)} max={new Date().toISOString().slice(0,10)} className="input"/></div><div><label className="label" htmlFor="registration-sport">{role==='player'?'Sports interest':'Sport'}</label><select id="registration-sport" value={d.sport||''} onChange={e=>set('sport',e.target.value)} required className="input"><option value="">Select a sport</option>{SPORTS.map(sport=><option key={sport} value={sport}>{sport}</option>)}<option value="Other">Other</option></select>{d.sport==='Other'&&<input aria-label="Enter another sport" placeholder="Type your sport" value={d.other_sport||''} onChange={e=>set('other_sport',e.target.value)} required maxLength={50} className="input mt-2"/>}</div><Field label="Experience (years)" type="number" value={d.experience||0} onChange={v=>set('experience',v)}/></>}{role==='coach'&&<><Field label="Coaching academy" value={d.academy||''} onChange={v=>set('academy',v)}/><Field label="Gender" value={d.gender||''} onChange={v=>set('gender',v)}/><FileField label="Profile photo" onChange={f=>set('photo',f)} accept="image/*" maxSize={1024*1024}/><FileField label="Coaching certificate" onChange={f=>set('certificate',f)} accept=".pdf,.jpg,.jpeg,.png"/></>}{role==='player'&&<><Field label="Level" value={d.level||''} onChange={v=>set('level',v)}/><Field label="District" value={d.district||''} onChange={v=>set('district',v)}/><Field label="State" value={d.state||''} onChange={v=>set('state',v)}/><Field label="Achievement title" value={d.achievement_title||''} onChange={v=>set('achievement_title',v)}/><Field label="Achievement year" type="number" value={d.achievement_year||''} onChange={v=>set('achievement_year',v)}/><FileField label="Achievement document" onChange={f=>set('achievement_proof',f)} accept=".pdf,.jpg,.jpeg,.png"/><FileField label="Profile photo" onChange={f=>set('photo',f)} accept="image/*" maxSize={1024*1024}/></>}</>}</div><button disabled={busy} className="btn-primary mt-6 w-full">{busy?'Please wait...':register?'Create account':'Sign in'}</button><div className="mt-5 text-center text-sm text-slate-500">{register?'Already have an account? ':'New to Athlenet? '}<Link className="font-bold text-orange-600" to={register?'/login':'/register'}>{register?'Sign in':'Create an account'}</Link></div></form></div></div>}
function FileField({label,onChange,accept,maxSize=5*1024*1024}){return <div><label className="label">{label}</label><input type="file" accept={accept} onChange={e=>{const file=e.target.files?.[0];if(file&&file.size>maxSize){alert(`${label} must not exceed ${maxSize===1024*1024?'1 MB':'5 MB'}.`);e.target.value='';return}onChange(file)}} className="block w-full rounded-xl border border-slate-200 p-3 text-sm"/><p className="mt-1 text-xs text-slate-500">Maximum file size: {maxSize===1024*1024?'1 MB':'5 MB'}.</p></div>}

function App(){return <AuthProvider><BrowserRouter><Routes><Route path="/login" element={<AuthGate><AuthPage/></AuthGate>}/><Route path="/register" element={<AuthGate><AuthPage register/></AuthGate>}/><Route path="/*" element={<PublicHome/>}/></Routes></BrowserRouter></AuthProvider>}
function AuthGate({children}){const {user,loading}=useAuth();if(loading)return <Loader/>;return user?<Navigate to="/" replace/>:children;}

createRoot(document.getElementById('root')).render(<App/>);
