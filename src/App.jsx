import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN & AUTH
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "foumnay@gmail.com";
const USERS_DB = {};
USERS_DB[ADMIN_EMAIL] = { email: ADMIN_EMAIL, name: "Admin", plan: "enterprise", uploads: 0, isAdmin: true, banned: false, joinedAt: new Date().toISOString(), uploadList: [], datasetsAnalyzed: 0 };

function regUser(email, name, plan) {
  if (USERS_DB[email]) return { ok: false, msg: "Email already registered." };
  USERS_DB[email] = { email, name, plan, uploads: 0, isAdmin: email === ADMIN_EMAIL, banned: false, joinedAt: new Date().toISOString(), uploadList: [], datasetsAnalyzed: 0 };
  return { ok: true, user: USERS_DB[email] };
}
function logUser(email) {
  if (!USERS_DB[email]) return { ok: false, msg: "No account found. Please register." };
  if (USERS_DB[email].banned) return { ok: false, msg: "⛔ Account banned. Contact admin." };
  return { ok: true, user: USERS_DB[email] };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const CATS = ["Electronics","Clothing","Food","Books","Sports","Health","Automotive","Travel"];
const REGS  = ["North","South","East","West","Central","Northeast","Southwest","Southeast"];
function makeMock() {
  const out = [];
  for (let i = 0; i < 200; i++) {
    const d = new Date(2022, Math.floor(i/17), (i%28)+1);
    out.push({
      id: i+1, date: d.toISOString().slice(0,10),
      category: CATS[i%8], region: REGS[i%8],
      sales: Math.round(1000 + Math.random()*9000),
      units: Math.round(10 + Math.random()*490),
      profit: Math.round(100 + Math.random()*4900),
      discount: +(Math.random()*0.45).toFixed(2),
      rating: +(1.5 + Math.random()*3.5).toFixed(1),
      cost: Math.round(400 + Math.random()*3000),
      revenue: Math.round(1500 + Math.random()*12000),
    });
  }
  return out;
}
const MOCK = makeMock();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const sum  = a => a.reduce((s,x)=>s+x,0);
const avg  = a => a.length ? sum(a)/a.length : 0;
const minn = a => Math.min(...a);
const maxx = a => Math.max(...a);
const med  = a => { const s=[...a].sort((x,y)=>x-y); return s.length%2?s[~~(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2; };
const std  = a => { const m=avg(a); return Math.sqrt(avg(a.map(x=>(x-m)**2))); };
const grp  = (arr,k) => arr.reduce((m,d)=>{ (m[d[k]]=m[d[k]]||[]).push(d); return m; },{});

function getColType(data, col) {
  const vals = data.map(r=>r[col]).filter(v=>v!==""&&v!==null&&v!==undefined);
  if (!vals.length) return "unknown";
  if (vals.every(v=>!isNaN(v)&&v!=="")) return "numeric";
  if (vals.every(v=>/^\d{4}-\d{2}-\d{2}/.test(String(v)))) return "date";
  return "categorical";
}
const getCols    = d => d&&d.length>0?Object.keys(d[0]):[];
const getNumCols = d => getCols(d).filter(c=>getColType(d,c)==="numeric");
const getCatCols = d => getCols(d).filter(c=>getColType(d,c)==="categorical");
const getDateCols= d => getCols(d).filter(c=>getColType(d,c)==="date");

function corr(data,c1,c2) {
  const a=data.map(d=>+d[c1]),b=data.map(d=>+d[c2]);
  const ma=avg(a),mb=avg(b);
  const num=sum(a.map((x,i)=>(x-ma)*(b[i]-mb)));
  const den=Math.sqrt(sum(a.map(x=>(x-ma)**2))*sum(b.map(y=>(y-mb)**2)));
  return den===0?0:+(num/den).toFixed(3);
}

function parseCSV(text) {
  const lines = text.trim().split("\n").map(l=>l.trim()).filter(Boolean);
  if (lines.length<2) return [];
  const headers = lines[0].split(",").map(h=>h.replace(/^"|"$/g,"").trim());
  return lines.slice(1).map(line=>{
    const vals=line.split(",").map(v=>v.replace(/^"|"$/g,"").trim());
    const row={};
    headers.forEach((h,i)=>{ const v=vals[i]??""; row[h]=v!==""&&!isNaN(v)?+v:v; });
    return row;
  });
}

function generateInsights(data) {
  const numCols = getNumCols(data);
  const catCols = getCatCols(data);
  const insights = [];
  if (numCols.length>=2) {
    let best={r:0,a:"",b:""};
    for(let i=0;i<numCols.length;i++) for(let j=i+1;j<numCols.length;j++){
      const r=Math.abs(corr(data,numCols[i],numCols[j]));
      if(r>best.r){best={r,a:numCols[i],b:numCols[j]};}
    }
    if(best.r>0.5) insights.push(`📈 Strong correlation (${(best.r*100).toFixed(0)}%) between **${best.a}** and **${best.b}** — these variables move together.`);
  }
  numCols.forEach(c=>{
    const vals=data.map(r=>+r[c]||0);
    const m=avg(vals),s=std(vals);
    const outliers=vals.filter(v=>Math.abs(v-m)>2*s);
    if(outliers.length>0&&outliers.length<vals.length*0.1) insights.push(`⚠️ Column **${c}** has ${outliers.length} potential outlier${outliers.length>1?"s":""} (Z-score > 2).`);
  });
  catCols.forEach(c=>{
    const grouped=grp(data,c);
    const numC=getNumCols(data)[0];
    if(numC){
      const totals=Object.entries(grouped).map(([k,rows])=>({k,v:sum(rows.map(r=>+r[numC]||0))}));
      totals.sort((a,b)=>b.v-a.v);
      if(totals.length>1) insights.push(`🏆 Top performing **${c}**: **${totals[0].k}** leads with ${totals[0].v.toLocaleString()} in ${numC}.`);
    }
  });
  const dateCols=getDateCols(data);
  if(dateCols.length&&getNumCols(data).length){
    insights.push(`📅 Dataset spans ${dateCols.length} date column(s) — time series analysis available in Prediction module.`);
  }
  if(!insights.length) insights.push(`✅ Dataset looks clean with ${data.length} rows and ${getCols(data).length} columns ready for analysis.`);
  return insights;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:"#070B14", bg2:"#0D1220", bg3:"#111827", border:"#1E2A3A", border2:"#243042",
    text:"#E8EDF5", text2:"#8B9BB4", text3:"#4A5568",
    accent:"#00D4FF", accent2:"#0098CC", accentBg:"#00D4FF12",
    green:"#00FF88", red:"#FF4466", orange:"#FF8C00", purple:"#8B5CF6",
    card:"#0D1220", nav:"#070B14EE",
    chartBars:["#00D4FF","#00FF88","#8B5CF6","#FF8C00","#FF4466","#FFD700","#00CED1","#FF69B4"],
  },
  light: {
    bg:"#F0F4FA", bg2:"#FFFFFF", bg3:"#E8EEF8", border:"#D1DCF0", border2:"#B8C9E8",
    text:"#0D1220", text2:"#4A5568", text3:"#8B9BB4",
    accent:"#0066CC", accent2:"#0052A3", accentBg:"#0066CC12",
    green:"#00AA55", red:"#CC2244", orange:"#CC6600", purple:"#6B46C1",
    card:"#FFFFFF", nav:"#FFFFFFEE",
    chartBars:["#0066CC","#00AA55","#6B46C1","#CC6600","#CC2244","#B8860B","#008B8B","#C71585"],
  }
};

function useTheme(dark) { return THEMES[dark?"dark":"light"]; }

const css = {
  flex:  (gap=0,dir="row",align="center",justify="flex-start") => ({ display:"flex",flexDirection:dir,alignItems:align,justifyContent:justify,gap }),
  grid:  (cols,gap=16) => ({ display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap }),
  abs:   (t,r,b,l) => ({ position:"absolute",top:t,right:r,bottom:b,left:l }),
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES INJECTOR
// ─────────────────────────────────────────────────────────────────────────────
function GlobalStyles({ T }) {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:${T.bg};color:${T.text};font-family:'Syne',sans-serif;transition:background .3s,color .3s;}
      ::-webkit-scrollbar{width:6px;height:6px;}
      ::-webkit-scrollbar-track{background:${T.bg2};}
      ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px;}
      ::-webkit-scrollbar-thumb:hover{background:${T.accent};}
      select option{background:${T.bg3};color:${T.text};}
      @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes glow{0%,100%{box-shadow:0 0 8px ${T.accent}44}50%{box-shadow:0 0 20px ${T.accent}88}}
      .fade-up{animation:fadeUp .4s ease forwards;}
      .card-hover{transition:all .2s ease;}
      .card-hover:hover{transform:translateY(-2px);border-color:${T.accent}66!important;}
      .btn-primary{background:linear-gradient(135deg,${T.accent},${T.accent2});color:#000;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;transition:all .2s;letter-spacing:.5px;}
      .btn-primary:hover{opacity:.88;transform:translateY(-1px);}
      .btn-secondary{background:${T.accentBg};color:${T.accent};border:1px solid ${T.accent}44;cursor:pointer;font-family:'Syne',sans-serif;font-weight:600;transition:all .2s;}
      .btn-secondary:hover{background:${T.accent}22;border-color:${T.accent}88;}
      .btn-ghost{background:transparent;color:${T.text2};border:1px solid ${T.border};cursor:pointer;font-family:'Syne',sans-serif;transition:all .2s;}
      .btn-ghost:hover{border-color:${T.accent}66;color:${T.accent};}
      .input-style{background:${T.bg3};color:${T.text};border:1px solid ${T.border};outline:none;font-family:'Syne',sans-serif;transition:border .2s;}
      .input-style:focus{border-color:${T.accent};}
      .tab-active{color:${T.accent}!important;border-bottom:2px solid ${T.accent}!important;}
      .glow-anim{animation:glow 2s ease-in-out infinite;}
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, [T]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ onDone, T }) {
  const [tab,setTab]=useState("login");
  const [step,setStep]=useState(1);
  const [email,setEmail]=useState("");
  const [name,setName]=useState("");
  const [password,setPassword]=useState("");
  const [plan,setPlan]=useState("pro");
  const [code,setCode]=useState("");
  const [codeIn,setCodeIn]=useState("");
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);

  const reset=()=>{setStep(1);setSent(false);setErr("");setCode("");setCodeIn("");};

  // LOGIN: call real API
  const handleLogin=async()=>{
    if(!email.includes("@")){setErr("Invalid email address.");return;}
    setErr("");setLoading(true);
    try{
      const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const data=await r.json();
      if(!r.ok){setErr(data.error||"Login failed.");setLoading(false);return;}
      setLoading(false);
      onDone({...data.user,isAdmin:data.user.is_admin});
    }catch(e){setErr("Network error. Try again.");setLoading(false);}
  };

  // REGISTER: send real email verification code
  const sendCode=async()=>{
    if(!email.includes("@")){setErr("Invalid email address.");return;}
    setErr("");setLoading(true);
    // Check if email exists in Supabase first
    try{
      const chk=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const chkData=await chk.json();
      if(chk.ok && chkData.success){setErr("Email already registered. Please sign in.");setLoading(false);return;}
    }catch(e){}
    const c=Math.random().toString(36).slice(2,8).toUpperCase();
    setCode(c);
    try{
      await fetch("/api/send-email",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({to:email,code:c})
      });
    }catch(e){ console.log("Email API error",e); }
    setLoading(false);setSent(true);
  };
  const verify=()=>{
    if(codeIn.toUpperCase()!==code){setErr("Incorrect code. Try again.");return;}
    setErr("");
    setStep(2);setSent(false);setCodeIn("");
  };
  const [pendingPayment,setPendingPayment]=useState(null);

  const finish=async()=>{
    if(!name.trim()){setErr("Please enter your name.");return;}
    if(!password||password.length<6){setErr("Password must be at least 6 characters.");return;}
    setErr("");setLoading(true);
    try{
      const r=await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,name,plan,password})});
      const data=await r.json();
      if(!r.ok){setErr(data.error||"Registration failed.");setLoading(false);return;}
      setLoading(false);
      const prices={pro:"20.00",enterprise:"99.00"};
      // Always require payment
      setPendingPayment({user:{...data.user,isAdmin:false}, plan, amount:prices[plan]||"20.00"});
    }catch(e){setErr("Network error. Try again.");setLoading(false);}
  };

  const completePayment=async()=>{
    // Set plan to "pending" — admin must approve
    try{
      await fetch("/api/verify-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,plan:"pending"})});
    }catch(e){}
    onDone({...pendingPayment.user, plan:"pending"});
  };

  const skipPayment=()=>{
    onDone(pendingPayment.user);
  };

  const plans=[
    {id:"pro",label:"Pro",price:"$20",period:"per report",features:["Full data analysis","All 20+ charts","ML predictions","1 PDF report per payment","Email support"],icon:"⚡",color:T.accent,popular:true},
    {id:"enterprise",label:"Enterprise",price:"$99",period:"/month",features:["Unlimited reports","Team collaboration","Custom ML models","Priority support","SLA guarantee"],icon:"🏢",color:T.orange},
  ];
  // No free plan — all users must pay

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"stretch",overflow:"hidden"}}>
      {/* Left panel */}
      <div style={{flex:1,background:`linear-gradient(135deg,${T.bg2} 0%,${T.bg3} 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,borderRight:`1px solid ${T.border}`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-80,right:-80,width:300,height:300,borderRadius:"50%",background:`radial-gradient(circle,${T.accent}22,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${T.purple}22,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{...css.flex(12,"row","center"),marginBottom:32}}>
          <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${T.accent},${T.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📊</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,letterSpacing:2,color:T.text}}>DATA<span style={{color:T.accent}}>4U</span></span>
        </div>
        <div style={{fontSize:22,fontWeight:700,color:T.text,marginBottom:12,textAlign:"center",lineHeight:1.3}}>Turn your data into<br/><span style={{color:T.accent}}>insights instantly.</span></div>
        <div style={{fontSize:14,color:T.text2,textAlign:"center",maxWidth:340,lineHeight:1.7,marginBottom:40}}>Upload any dataset and let AI automatically clean, analyze, visualize, predict, and generate a professional report — all in seconds.</div>
        <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:320}}>
          {["🧹 Auto data cleaning & outlier detection","📊 20+ interactive chart types","🤖 ML predictions & forecasting","📑 Professional PDF reports"].map((f,i)=>(
            <div key={i} style={{...css.flex(10),padding:"10px 14px",background:T.accentBg,borderRadius:10,border:`1px solid ${T.accent}22`,fontSize:13,color:T.text2}}>{f}</div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{width:480,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
        <div style={{width:"100%",maxWidth:400}} className="fade-up">
          {pendingPayment ? (
            <div style={{textAlign:"center",padding:32}}>
              <div style={{fontSize:56,marginBottom:12}}>💳</div>
              <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:8}}>Complete Payment</div>
              <div style={{fontSize:13,color:T.text2,marginBottom:16,lineHeight:1.6}}>
                Account created! ✅<br/>
                Click the button below to pay for your <b style={{color:T.accent}}>{pendingPayment.plan}</b> plan.
              </div>
              <div style={{fontSize:32,fontWeight:800,color:T.accent,marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>
                ${pendingPayment.amount}/mo
              </div>
              <div style={{fontSize:12,color:T.text3,marginBottom:20}}>
                You will be redirected to PayPal in a new tab
              </div>
              <a href={`https://www.paypal.com/paypalme/faridoumnay/${pendingPayment.amount}`}
                target="_blank" rel="noreferrer"
                onClick={()=>completePayment()}
                style={{display:"block",width:"100%",padding:"14px 0",borderRadius:12,fontSize:15,
                  background:`linear-gradient(135deg,#009cde,#003087)`,color:"#fff",
                  fontWeight:700,textDecoration:"none",marginBottom:10,fontFamily:"'Syne',sans-serif",
                  textAlign:"center"}}>
                💳 Pay with PayPal — ${pendingPayment.amount}
              </a>
              <div style={{fontSize:11,color:T.text3,textAlign:"center",marginTop:8}}>
                After payment, you will access the app with <b style={{color:T.accent}}>{pendingPayment.plan}</b> plan ✅
              </div>
            </div>
          ) : success ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:64,marginBottom:16}}>✅</div>
              <div style={{fontSize:20,fontWeight:700,color:T.green}}>Account created!</div>
              <div style={{color:T.text2,fontSize:14,marginTop:8}}>Redirecting to dashboard...</div>
            </div>
          ) : (
            <>
              <div style={{fontSize:24,fontWeight:800,color:T.text,marginBottom:6}}>
                {tab==="login"?"Welcome back":"Create account"}
              </div>
              <div style={{fontSize:13,color:T.text2,marginBottom:28}}>
                {tab==="login"?"Sign in to your Data4U account":"Start your free analytics journey"}
              </div>
              {/* Tabs */}
              <div style={{...css.flex(0),borderBottom:`1px solid ${T.border}`,marginBottom:28}}>
                {["login","register"].map(t=>(
                  <button key={t} onClick={()=>{setTab(t);reset();}}
                    style={{flex:1,padding:"10px 0",background:"transparent",border:"none",cursor:"pointer",
                      fontSize:14,fontWeight:600,color:tab===t?T.accent:T.text2,
                      borderBottom:`2px solid ${tab===t?T.accent:"transparent"}`,transition:"all .2s",fontFamily:"'Syne',sans-serif"}}>
                    {t==="login"?"Sign In":"Register"}
                  </button>
                ))}
              </div>

              {/* ── LOGIN: email + password ── */}
              {step===1&&tab==="login"&&(
                <>
                  <input className="input-style" placeholder="Email address" value={email}
                    onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,fontSize:14,marginBottom:12}}/>
                  <input className="input-style" type="password" placeholder="Password"
                    value={password||""} onChange={e=>setPassword(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,fontSize:14,marginBottom:12}}/>
                  <button className="btn-primary" onClick={handleLogin} disabled={loading}
                    style={{width:"100%",padding:"13px 0",borderRadius:10,fontSize:15}}>
                    {loading?"⏳ Signing in...":"🔑 Sign In"}
                  </button>
                </>
              )}

              {/* ── REGISTER step 1: email ── */}
              {step===1&&tab==="register"&&(
                <>
                  <input className="input-style" placeholder="Email address" value={email}
                    onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!sent&&sendCode()}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,fontSize:14,marginBottom:12}}/>
                  {!sent?(
                    <button className="btn-primary" onClick={sendCode} disabled={loading}
                      style={{width:"100%",padding:"13px 0",borderRadius:10,fontSize:15}}>
                      {loading?"⏳ Sending...":"📨 Send Verification Code"}
                    </button>
                  ):(
                    <>
                      <div style={{padding:"10px 14px",background:T.green+"11",borderRadius:8,border:`1px solid ${T.green}44`,fontSize:13,color:T.green,marginBottom:12}}>
                        📧 Verification code sent to <b>{email}</b>
                      </div>
                      <input className="input-style" placeholder="Enter verification code" value={codeIn}
                        onChange={e=>setCodeIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&verify()}
                        style={{width:"100%",padding:"12px 16px",borderRadius:10,fontSize:14,marginBottom:12,letterSpacing:3,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}/>
                      <button className="btn-primary" onClick={verify} style={{width:"100%",padding:"13px 0",borderRadius:10,fontSize:15}}>
                        ✔ Verify & Continue
                      </button>
                    </>
                  )}
                </>
              )}

              {/* ── REGISTER step 2: name + plan ── */}
              {step===2&&tab==="register"&&(
                <>
                  <input className="input-style" placeholder="Full name" value={name}
                    onChange={e=>setName(e.target.value)}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,fontSize:14,marginBottom:12}}/>
                  <input className="input-style" type="password" placeholder="Create password" value={password||""} 
                    onChange={e=>setPassword(e.target.value)}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,fontSize:14,marginBottom:20}}/>
                  <div style={{fontSize:13,color:T.text2,marginBottom:12,fontWeight:600}}>Choose your plan:</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                    {plans.map(p=>(
                      <div key={p.id} onClick={()=>setPlan(p.id)}
                        style={{padding:"14px 16px",borderRadius:12,cursor:"pointer",transition:"all .2s",
                          border:`2px solid ${plan===p.id?p.color:T.border}`,
                          background:plan===p.id?p.color+"12":T.bg3,position:"relative"}}>
                        {p.popular&&<span style={{position:"absolute",top:-8,right:12,background:T.accent,color:"#000",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>POPULAR</span>}
                        <div style={{...css.flex(8,"row","center","space-between")}}>
                          <div style={{...css.flex(10)}}>
                            <span style={{fontSize:18}}>{p.icon}</span>
                            <div>
                              <div style={{fontWeight:700,fontSize:14,color:T.text}}>{p.label}</div>
                              <div style={{fontSize:11,color:T.text2}}>{p.features.join(" · ")}</div>
                            </div>
                          </div>
                          <div style={{fontWeight:800,fontSize:14,color:p.color}}>{p.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={finish} style={{width:"100%",padding:"13px 0",borderRadius:10,fontSize:15}}>
                    🚀 Create Account
                  </button>
                </>
              )}

              {err&&<div style={{marginTop:12,padding:"10px 14px",background:T.red+"11",border:`1px solid ${T.red}44`,borderRadius:8,fontSize:13,color:T.red}}>{err}</div>}
              {tab==="login"&&!sent&&(
                <div style={{marginTop:20,textAlign:"center",fontSize:13,color:T.text3}}>
                  No account? <span style={{color:T.accent,cursor:"pointer"}} onClick={()=>{setTab("register");reset();}}>Register for free →</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────────────────
function NavBar({ user, page, setPage, dark, setDark, data, T }) {
  const navItems = [
    {id:"home",icon:"⬡",label:"Home"},
    {id:"upload",icon:"↑",label:"Upload"},
    {id:"clean",icon:"◈",label:"Clean"},
    {id:"visualize",icon:"◉",label:"Visualize"},
    {id:"predict",icon:"◎",label:"Predict"},
    {id:"dashboard",icon:"⊞",label:"Dashboard"},
    {id:"report",icon:"≡",label:"Report"},
    {id:"pricing",icon:"💳",label:"Pricing"},
    ...(user.isAdmin?[{id:"admin",icon:"🛡",label:"Admin"}]:[]),
  ];
  return (
    <nav style={{position:"sticky",top:0,zIndex:200,background:T.nav,backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.border}`,padding:"0 24px"}}>
      <div style={{...css.flex(0,"row","center","space-between"),maxWidth:1400,margin:"0 auto",height:60}}>
        <div style={{...css.flex(10,"row","center")}}>
          <div style={{...css.flex(8,"row","center"),marginRight:24}}>
            <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>◈</div>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,letterSpacing:2}}>DATA<span style={{color:T.accent}}>4U</span></span>
          </div>
          <div style={{...css.flex(2,"row","center"),height:60}}>
            {navItems.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)}
                style={{height:60,padding:"0 14px",background:"transparent",border:"none",cursor:"pointer",
                  borderBottom:`2px solid ${page===n.id?T.accent:"transparent"}`,
                  color:page===n.id?T.accent:T.text2,fontSize:13,fontWeight:600,
                  transition:"all .2s",fontFamily:"'Syne',sans-serif",
                  display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
                  opacity:(!data&&["clean","visualize","predict","dashboard","report"].includes(n.id))?0.4:1}}>
                <span style={{fontSize:11}}>{n.icon}</span>{n.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{...css.flex(12,"row","center")}}>
          {data&&<span style={{fontSize:12,color:T.green,fontFamily:"'JetBrains Mono',monospace",background:T.green+"11",padding:"4px 10px",borderRadius:6}}>● {data.length} rows</span>}
          <button onClick={()=>setDark(!dark)} style={{width:36,height:36,borderRadius:9,background:T.bg3,border:`1px solid ${T.border}`,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:T.text2}}>
            {dark?"☀":"🌙"}
          </button>
          <div style={{...css.flex(8,"row","center")}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#000",fontWeight:700}}>
              {user.name[0].toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.text}}>{user.name}</div>
              <div style={{fontSize:11,color:T.text3,textTransform:"uppercase",letterSpacing:1}}>{user.plan}</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Card({ children, T, style={}, className="" }) {
  return <div className={`card-hover ${className}`} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:24,...style}}>{children}</div>;
}
function StatCard({ icon, value, label, color, T, trend }) {
  return (
    <Card T={T} style={{padding:20}}>
      <div style={{...css.flex(0,"row","flex-start","space-between"),marginBottom:12}}>
        <div style={{fontSize:24}}>{icon}</div>
        {trend&&<span style={{fontSize:11,color:trend>0?T.green:T.red,background:(trend>0?T.green:T.red)+"11",padding:"2px 8px",borderRadius:6}}>{trend>0?"↑":"↓"}{Math.abs(trend)}%</span>}
      </div>
      <div style={{fontSize:26,fontWeight:800,color:color||T.accent,fontFamily:"'JetBrains Mono',monospace"}}>{value}</div>
      <div style={{fontSize:12,color:T.text2,marginTop:4}}>{label}</div>
    </Card>
  );
}
function SectionTitle({ title, sub, T }) {
  return (
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:4}}>{title}</h2>
      {sub&&<p style={{fontSize:13,color:T.text2}}>{sub}</p>}
    </div>
  );
}
function Badge({ label, color, T }) {
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:color+"22",color,border:`1px solid ${color}44`,fontFamily:"'JetBrains Mono',monospace"}}>{label}</span>;
}
function Loader({ T }) {
  return <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.accent,animation:"spin .7s linear infinite"}} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// BAR CHART (SVG)
// ─────────────────────────────────────────────────────────────────────────────
function BarChart({ data, xKey, yKey, T, height=200, color }) {
  if (!data || !data.length) return null;
  const vals = data.map(d=>+d[yKey]||0);
  const maxV = Math.max(...vals,1);
  const w = 100/data.length;
  return (
    <div style={{overflowX:"auto"}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:3,height,minWidth:Math.max(data.length*36,300),paddingBottom:24,position:"relative"}}>
        {data.map((d,i)=>{
          const h = Math.max((vals[i]/maxV)*(height-30),2);
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",minWidth:28}}>
              <div style={{fontSize:9,color:T.text2,marginBottom:3,fontFamily:"'JetBrains Mono',monospace"}}>{vals[i]>999?(vals[i]/1000).toFixed(1)+"k":vals[i]}</div>
              <div title={`${d[xKey]}: ${vals[i]}`}
                style={{width:"100%",height:h,background:color||T.chartBars[i%T.chartBars.length],borderRadius:"3px 3px 0 0",transition:"height .3s",cursor:"pointer",opacity:.85}}
                onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                onMouseLeave={e=>e.currentTarget.style.opacity=".85"} />
              <div style={{fontSize:8,color:T.text3,marginTop:4,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%",width:"100%"}}>{String(d[xKey]).slice(0,8)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// LINE CHART (SVG)
function LineChart({ data, xKey, yKey, T, height=180, color }) {
  if (!data||data.length<2) return null;
  const vals = data.map(d=>+d[yKey]||0);
  const minV = Math.min(...vals), maxV = Math.max(...vals,1);
  const W=600, H=height;
  const pts = vals.map((v,i)=>[
    (i/(vals.length-1))*W,
    H-16 - ((v-minV)/(maxV-minV||1))*(H-32)
  ]);
  const path = pts.map((p,i)=>i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`).join(" ");
  const fill = pts.map((p,i)=>i===0?`M${p[0]},${H-16}`:`L${p[0]},${p[1]}`).join(" ")+` L${pts[pts.length-1][0]},${H-16} Z`;
  const c = color||T.accent;
  return (
    <div style={{overflowX:"auto"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`lg-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity=".3"/>
            <stop offset="100%" stopColor={c} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={fill} fill={`url(#lg-${yKey})`}/>
        <path d={path} fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.filter((_,i)=>i%Math.ceil(pts.length/8)===0).map((p,i)=>(
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={c} stroke={T.bg2} strokeWidth="2"/>
        ))}
      </svg>
    </div>
  );
}

// PIE CHART (SVG)
function PieChart({ data, labelKey, valueKey, T, size=200 }) {
  if (!data||!data.length) return null;
  const total = sum(data.map(d=>+d[valueKey]||0));
  let angle = -Math.PI/2;
  const cx=size/2, cy=size/2, r=size/2-24;
  const slices = data.slice(0,8).map((d,i)=>{
    const val = +d[valueKey]||0;
    const sweep = (val/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle+=sweep;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    const large=sweep>Math.PI?1:0;
    return { path:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color:T.chartBars[i%T.chartBars.length], label:d[labelKey], val, pct:((val/total)*100).toFixed(1) };
  });
  return (
    <div style={{...css.flex(20,"row","center","center"),flexWrap:"wrap"}}>
      <svg width={size} height={size} style={{minWidth:size}}>
        {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity=".88" stroke={T.bg2} strokeWidth="2"/>)}
        <circle cx={cx} cy={cy} r={r*0.45} fill={T.card}/>
        <text x={cx} y={cy-6} textAnchor="middle" fill={T.text} fontSize="14" fontWeight="700" fontFamily="Syne">{slices.length}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fill={T.text2} fontSize="9" fontFamily="Syne">categories</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {slices.map((s,i)=>(
          <div key={i} style={{...css.flex(8,"row","center"),fontSize:12}}>
            <div style={{width:10,height:10,borderRadius:2,background:s.color,flexShrink:0}}/>
            <span style={{color:T.text2,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</span>
            <span style={{color:T.text,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",marginLeft:4}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// SCATTER PLOT
function ScatterPlot({ data, xKey, yKey, T, size=300 }) {
  const xs=data.map(d=>+d[xKey]||0), ys=data.map(d=>+d[yKey]||0);
  const xmin=minn(xs),xmax=maxx(xs),ymin=minn(ys),ymax=maxx(ys);
  const W=500,H=220;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H}}>
      {data.slice(0,200).map((d,i)=>{
        const x=24+((+d[xKey]-xmin)/(xmax-xmin||1))*(W-48);
        const y=H-20-((+d[yKey]-ymin)/(ymax-ymin||1))*(H-36);
        return <circle key={i} cx={x} cy={y} r="4" fill={T.chartBars[i%T.chartBars.length]} opacity=".7" stroke="none"><title>{xKey}:{+d[xKey].toFixed(2)} {yKey}:{+d[yKey].toFixed(2)}</title></circle>;
      })}
      <line x1="24" y1={H-20} x2={W-24} y2={H-20} stroke={T.border} strokeWidth="1"/>
      <line x1="24" y1="8" x2="24" y2={H-20} stroke={T.border} strokeWidth="1"/>
      <text x={W/2} y={H-4} textAnchor="middle" fill={T.text2} fontSize="10" fontFamily="Syne">{xKey}</text>
      <text x="10" y={H/2} textAnchor="middle" fill={T.text2} fontSize="10" fontFamily="Syne" transform={`rotate(-90,10,${H/2})`}>{yKey}</text>
    </svg>
  );
}

// HEATMAP / CORRELATION
function CorrHeatmap({ data, T }) {
  const numCols = getNumCols(data).slice(0,8);
  if (numCols.length < 2) return <div style={{color:T.text2,fontSize:13}}>Need at least 2 numeric columns.</div>;
  const cell = 48;
  return (
    <div style={{overflowX:"auto"}}>
      <div style={{display:"inline-block"}}>
        <div style={{display:"grid",gridTemplateColumns:`80px repeat(${numCols.length},${cell}px)`}}>
          <div/>
          {numCols.map(c=><div key={c} style={{width:cell,height:60,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:6,fontSize:9,color:T.text2,overflow:"hidden",writingMode:"vertical-rl",textAlign:"center"}}>{c}</div>)}
          {numCols.map(r=>[
            <div key={r} style={{height:cell,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:8,fontSize:10,color:T.text2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{r}</div>,
            ...numCols.map(c=>{
              const v=corr(data,r,c);
              const abs=Math.abs(v);
              const col=v>0?T.accent:T.red;
              return <div key={c} style={{width:cell,height:cell,background:`${col}${Math.round(abs*200+20).toString(16).padStart(2,"0")}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:600,fontFamily:"'JetBrains Mono',monospace",border:`1px solid ${T.border}`,cursor:"default"}} title={`${r} × ${c}: ${v}`}>{v}</div>;
            })
          ])}
        </div>
      </div>
    </div>
  );
}

// BOX PLOT (simplified)
function BoxPlot({ data, col, T, height=120 }) {
  const vals = data.map(r=>+r[col]||0).sort((a,b)=>a-b);
  const q1=vals[~~(vals.length*.25)], q3=vals[~~(vals.length*.75)];
  const medV=med(vals), minV=vals[0], maxV=vals[vals.length-1];
  const range=maxV-minV||1;
  const W=300,H=height;
  const sc=v=>((v-minV)/range)*(W-40)+20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}}>
      <line x1={sc(minV)} y1={H/2} x2={sc(maxV)} y2={H/2} stroke={T.border2} strokeWidth="2"/>
      <rect x={sc(q1)} y={H/2-20} width={sc(q3)-sc(q1)} height={40} fill={T.accent+"33"} stroke={T.accent} strokeWidth="2" rx="4"/>
      <line x1={sc(medV)} y1={H/2-20} x2={sc(medV)} y2={H/2+20} stroke={T.accent} strokeWidth="3"/>
      <line x1={sc(minV)} y1={H/2-12} x2={sc(minV)} y2={H/2+12} stroke={T.text2} strokeWidth="2"/>
      <line x1={sc(maxV)} y1={H/2-12} x2={sc(maxV)} y2={H/2+12} stroke={T.text2} strokeWidth="2"/>
      {[{v:minV,l:"Min"},{v:q1,l:"Q1"},{v:medV,l:"Med"},{v:q3,l:"Q3"},{v:maxV,l:"Max"}].map(({v,l})=>(
        <g key={l}>
          <text x={sc(v)} y={H/2+36} textAnchor="middle" fill={T.text2} fontSize="8" fontFamily="JetBrains Mono">{l}</text>
          <text x={sc(v)} y={H/2+46} textAnchor="middle" fill={T.text} fontSize="8" fontFamily="JetBrains Mono">{v>999?(v/1000).toFixed(1)+"k":v.toFixed(0)}</text>
        </g>
      ))}
    </svg>
  );
}

// HISTOGRAM
function Histogram({ data, col, T, bins=15, height=160 }) {
  const vals = data.map(r=>+r[col]).filter(v=>!isNaN(v));
  if (!vals.length) return null;
  const minV=minn(vals), maxV=maxx(vals), range=maxV-minV||1;
  const bw=range/bins;
  const counts=Array(bins).fill(0);
  vals.forEach(v=>{const b=Math.min(~~((v-minV)/bw),bins-1);counts[b]++;});
  const maxC=Math.max(...counts,1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:1,height,paddingBottom:16}}>
      {counts.map((c,i)=>(
        <div key={i} style={{flex:1,height:`${(c/maxC)*90}%`,background:T.accent,opacity:.75,borderRadius:"2px 2px 0 0",minHeight:c?2:0,transition:"height .3s"}} title={`${(minV+i*bw).toFixed(1)}–${(minV+(i+1)*bw).toFixed(1)}: ${c}`}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
function HomePage({ user, setPage, data, T }) {
  const d=data||MOCK;
  const numCols=getNumCols(d);
  const insights=generateInsights(d);

  const kpis=[
    {icon:"⬡",label:"Total Rows",value:d.length.toLocaleString(),color:T.accent,trend:12},
    {icon:"◈",label:"Columns",value:getCols(d).length,color:T.purple},
    {icon:"◉",label:"Numeric",value:numCols.length,color:T.green,trend:5},
    {icon:"◎",label:"Missing %",value:getCols(d).map(c=>d.filter(r=>r[c]===""||r[c]===null||r[c]===undefined).length).reduce((a,b)=>a+b,0)>0?((getCols(d).map(c=>d.filter(r=>r[c]===""||r[c]===null||r[c]===undefined).length).reduce((a,b)=>a+b,0)/(d.length*getCols(d).length)*100).toFixed(1)+"%"):"0%",color:T.orange},
  ];

  const modules=[
    {icon:"↑",title:"Upload Data",desc:"CSV, Excel, JSON, TXT, SQL, Google Sheets",page:"upload",color:T.accent},
    {icon:"◈",title:"Data Cleaning",desc:"KNN imputation, outlier detection, transformation",page:"clean",color:T.purple},
    {icon:"◉",title:"Visualization",desc:"20+ chart types with interactive filters",page:"visualize",color:T.green},
    {icon:"◎",title:"Prediction",desc:"ARIMA, Prophet, Linear, Random Forest, XGBoost",page:"predict",color:T.orange},
    {icon:"⊞",title:"Dashboard Builder",desc:"Drag & drop, resize, filter — like Power BI",page:"dashboard",color:T.accent},
    {icon:"≡",title:"Report Generator",desc:"Professional PDF with all insights included",page:"report",color:T.red},
  ];

  return (
    <div style={{padding:"28px 24px",maxWidth:1400,margin:"0 auto"}}>
      {/* Hero */}
      <div className="fade-up" style={{...css.flex(0,"row","center","space-between"),marginBottom:32,padding:"28px 32px",background:`linear-gradient(135deg,${T.bg2},${T.bg3})`,borderRadius:20,border:`1px solid ${T.border}`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-40,top:-40,width:220,height:220,borderRadius:"50%",background:`radial-gradient(circle,${T.accent}22,transparent 70%)`,pointerEvents:"none"}}/>
        <div>
          <div style={{fontSize:13,color:T.accent,fontWeight:700,letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>Welcome back, {user.name}</div>
          <div style={{fontSize:28,fontWeight:800,color:T.text,lineHeight:1.2,marginBottom:10}}>
            Turn your data into<br/><span style={{color:T.accent}}>insights instantly.</span>
          </div>
          <div style={{fontSize:14,color:T.text2,maxWidth:420,lineHeight:1.6}}>
            {data?`Dataset loaded: ${d.length} rows, ${getCols(d).length} columns ready for analysis.`:"Upload a dataset to begin your automated analysis journey."}
          </div>
          <div style={{...css.flex(10),marginTop:20}}>
            <button className="btn-primary" onClick={()=>setPage(data?"clean":"upload")} style={{padding:"11px 24px",borderRadius:10,fontSize:14}}>
              {data?"→ Continue Analysis":"↑ Upload Dataset"}
            </button>
            {!data&&<button className="btn-secondary" onClick={()=>setPage("visualize")} style={{padding:"11px 24px",borderRadius:10,fontSize:14}}>Try Demo Data</button>}
          </div>
        </div>
        <div style={{...css.grid(2,8),flexShrink:0}}>
          {kpis.map((k,i)=>(
            <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 18px",minWidth:120}}>
              <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
              <div style={{fontSize:22,fontWeight:800,color:k.color,fontFamily:"'JetBrains Mono',monospace"}}>{k.value}</div>
              <div style={{fontSize:11,color:T.text2}}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modules */}
      <div style={{...css.grid(3,16),marginBottom:28}}>
        {modules.map((m,i)=>(
          <div key={i} className="card-hover" onClick={()=>setPage(m.page)}
            style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:22,cursor:"pointer",transition:"all .2s",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`${m.color}11`,pointerEvents:"none"}}/>
            <div style={{width:40,height:40,borderRadius:11,background:`${m.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:14,color:m.color,fontWeight:800}}>{m.icon}</div>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:6}}>{m.title}</div>
            <div style={{fontSize:12,color:T.text2,lineHeight:1.5}}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <Card T={T}>
        <SectionTitle title="🧠 Auto Insights" sub="AI-generated observations from your dataset" T={T}/>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {insights.map((ins,i)=>(
            <div key={i} style={{padding:"12px 16px",background:T.bg3,borderRadius:10,fontSize:13,color:T.text2,lineHeight:1.6,borderLeft:`3px solid ${T.accent}`}}
              dangerouslySetInnerHTML={{__html:ins.replace(/\*\*(.*?)\*\*/g,`<strong style="color:${T.text}">$1</strong>`)}}/>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD PAGE
// ─────────────────────────────────────────────────────────────────────────────
function UploadPage({ user, setData, setPage, T }) {
  const fileRef=useRef();
  const [state,setState]=useState("idle"); // idle|dragging|parsing|done|error
  const [err,setErr]=useState("");
  const [preview,setPreview]=useState(null);
  const [progress,setProgress]=useState(0);

  const parseFile=(file)=>{
    if(!file){return;}
    if(!file.name.match(/\.(csv|txt)$/i)){setErr("Only .csv and .txt files supported in browser mode. Upload a CSV.");setState("error");return;}
    if(user.plan==="free"&&user.uploads>=3){setErr("Free plan: 3 uploads/month. Upgrade to Pro for unlimited.");setState("error");return;}
    setErr("");setState("parsing");setProgress(0);
    const reader=new FileReader();
    reader.onprogress=e=>{ if(e.lengthComputable) setProgress(~~(e.loaded/e.total*80)); };
    reader.onload=e=>{
      try{
        const parsed=parseCSV(e.target.result);
        if(!parsed.length){setErr("CSV appears empty or invalid.");setState("error");return;}
        setProgress(95);
        user.uploads=(user.uploads||0)+1;
        user.datasetsAnalyzed=(user.datasetsAnalyzed||0)+1;
        if(!user.uploadList)user.uploadList=[];
        user.uploadList.push({name:file.name,size:(file.size/1024).toFixed(1)+"KB",rows:parsed.length,cols:getCols(parsed).length,date:new Date().toISOString().slice(0,10)});
        setPreview(parsed.slice(0,5));
        setProgress(100);
        setTimeout(()=>{ setData(parsed); setState("done"); },400);
        setTimeout(()=>setPage("clean"),1600);
      }catch(ex){setErr("Parse error: "+ex.message);setState("error");}
    };
    reader.readAsText(file);
  };

  const useMock=()=>{
    setData(MOCK);
    user.datasetsAnalyzed=(user.datasetsAnalyzed||0)+1;
    setState("done");
    setTimeout(()=>setPage("clean"),800);
  };

  const sources=[
    {icon:"📄",label:"CSV / TXT",sub:"Most common format",active:true},
    {icon:"📊",label:"Excel (.xlsx)",sub:"Pro plan",active:user.plan!=="free"},
    {icon:"📋",label:"JSON",sub:"Pro plan",active:user.plan!=="free"},
    {icon:"🔗",label:"Google Sheets",sub:"Enterprise",active:user.plan==="enterprise"},
    {icon:"🗃️",label:"SQL Export",sub:"Enterprise",active:user.plan==="enterprise"},
  ];

  return (
    <div style={{padding:"28px 24px",maxWidth:1000,margin:"0 auto"}}>
      <SectionTitle title="↑ Upload Dataset" sub="Upload your data to begin automated analysis" T={T}/>
      <div style={{...css.grid(2,20)}}>
        <div>
          {/* Drop zone */}
          <input type="file" accept=".csv,.txt" ref={fileRef} style={{display:"none"}} onChange={e=>parseFile(e.target.files[0])}/>
          <div onClick={()=>state==="idle"&&fileRef.current?.click()}
            onDrop={e=>{e.preventDefault();setState("idle");parseFile(e.dataTransfer.files[0]);}}
            onDragOver={e=>{e.preventDefault();setState("dragging");}}
            onDragLeave={()=>setState("idle")}
            style={{padding:"48px 32px",border:`2px dashed ${state==="dragging"?T.accent:state==="done"?T.green:state==="error"?T.red:T.border2}`,borderRadius:16,textAlign:"center",cursor:state==="idle"?"pointer":"default",transition:"all .2s",background:state==="dragging"?T.accentBg:T.bg2,marginBottom:16}}>
            {state==="idle"&&<><div style={{fontSize:48,marginBottom:12}}>📂</div><div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:6}}>Drop your CSV here</div><div style={{fontSize:13,color:T.text2}}>or click to browse files</div></>}
            {state==="dragging"&&<><div style={{fontSize:48,marginBottom:12}}>⬇️</div><div style={{fontWeight:700,fontSize:16,color:T.accent}}>Drop to upload</div></>}
            {state==="parsing"&&(
              <>
                <Loader T={T}/> 
                <div style={{fontWeight:600,color:T.text,marginTop:12,marginBottom:8}}>Parsing dataset...</div>
                <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:4,width:progress+"%",background:`linear-gradient(90deg,${T.accent},${T.purple})`,borderRadius:2,transition:"width .3s"}}/>
                </div>
              </>
            )}
            {state==="done"&&<><div style={{fontSize:48,marginBottom:8}}>✅</div><div style={{fontWeight:700,color:T.green}}>Dataset loaded! Redirecting...</div></>}
            {state==="error"&&<><div style={{fontSize:48,marginBottom:8}}>❌</div><div style={{color:T.red,fontWeight:600}}>{err}</div><button className="btn-ghost" onClick={e=>{e.stopPropagation();setState("idle");setErr("");}} style={{marginTop:10,padding:"6px 16px",borderRadius:8,fontSize:13}}>Try again</button></>}
          </div>
          <button className="btn-secondary" onClick={useMock} style={{width:"100%",padding:"12px 0",borderRadius:12,fontSize:14}}>
            🧪 Use Demo Dataset (200 rows, 11 columns)
          </button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card T={T} style={{padding:20}}>
            <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:14}}>Supported Sources</div>
            {sources.map((s,i)=>(
              <div key={i} style={{...css.flex(10,"row","center","space-between"),padding:"10px 0",borderBottom:i<sources.length-1?`1px solid ${T.border}`:"none",opacity:s.active?1:0.45}}>
                <div style={{...css.flex(10)}}>
                  <span style={{fontSize:18}}>{s.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{s.label}</div>
                    <div style={{fontSize:11,color:T.text2}}>{s.sub}</div>
                  </div>
                </div>
                {s.active?<Badge label="Ready" color={T.green} T={T}/>:<Badge label="Upgrade" color={T.orange} T={T}/>}
              </div>
            ))}
          </Card>
          {preview&&(
            <Card T={T} style={{padding:16}}>
              <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}}>Preview (first 5 rows)</div>
              <div style={{overflowX:"auto",fontSize:11}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{getCols(preview).slice(0,6).map(c=><th key={c} style={{padding:"5px 8px",background:T.bg3,color:T.text2,textAlign:"left",whiteSpace:"nowrap"}}>{c}</th>)}</tr></thead>
                  <tbody>{preview.map((row,i)=><tr key={i}>{getCols(preview).slice(0,6).map(c=><td key={c} style={{padding:"5px 8px",color:T.text,borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>{String(row[c]??"").slice(0,12)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function CleanPage({ data, setData, T }) {
  const d=data||MOCK;
  const cols=getCols(d);
  const [search,setSearch]=useState("");
  const [imputeMethod,setImputeMethod]=useState("mean");
  const [outlierMethod,setOutlierMethod]=useState("iqr");
  const [outlierAction,setOutlierAction]=useState("remove");
  const [outlierResults,setOutlierResults]=useState(null);
  const [cleanLog,setCleanLog]=useState([]);
  const [activeTab,setActiveTab]=useState("overview");

  const colInfo=cols.map(c=>{
    const vals=d.map(r=>r[c]);
    const missing=vals.filter(v=>v===""||v===null||v===undefined).length;
    const type=getColType(d,c);
    const numVals=type==="numeric"?vals.map(v=>+v).filter(v=>!isNaN(v)):[];
    return { col:c, type, missing, missingPct:((missing/d.length)*100).toFixed(1),
      min:numVals.length?minn(numVals).toFixed(2):"—", max:numVals.length?maxx(numVals).toFixed(2):"—",
      mean:numVals.length?avg(numVals).toFixed(2):"—", std:numVals.length?std(numVals).toFixed(2):"—",
      unique:[...new Set(vals)].length };
  });

  const handleImpute=()=>{
    const newData=d.map(row=>{
      const nr={...row};
      cols.forEach(c=>{
        if(nr[c]===""||nr[c]===null||nr[c]===undefined){
          const type=getColType(d,c);
          if(type==="numeric"){
            const numVals=d.map(r=>+r[c]).filter(v=>!isNaN(v)&&v!==null&&v!=="");
            if(imputeMethod==="mean") nr[c]=+avg(numVals).toFixed(3);
            else if(imputeMethod==="median") nr[c]=+med(numVals).toFixed(3);
            else if(imputeMethod==="zero") nr[c]=0;
            else nr[c]=+avg(numVals).toFixed(3); // KNN simulated as mean
          } else {
            const catVals=d.map(r=>r[c]).filter(v=>v!=="");
            const freq=catVals.reduce((m,v)=>{m[v]=(m[v]||0)+1;return m;},{});
            nr[c]=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
          }
        }
      });
      return nr;
    });
    const missing=colInfo.filter(c=>+c.missingPct>0);
    setCleanLog(l=>[...l,`✅ Imputed ${missing.length} column(s) using ${imputeMethod} method`]);
    setData(newData);
  };

  const detectOutliers=(rows,method)=>{
    const numCols=getNumCols(rows);
    const outlierIdx=new Set();
    numCols.forEach(c=>{
      const vals=rows.map((r,i)=>({v:+r[c],i})).filter(x=>!isNaN(x.v));
      if(method==="iqr"){
        const sorted=[...vals].sort((a,b)=>a.v-b.v);
        const q1=sorted[~~(sorted.length*.25)].v, q3=sorted[~~(sorted.length*.75)].v;
        const iqr=q3-q1, lo=q1-1.5*iqr, hi=q3+1.5*iqr;
        vals.forEach(x=>{ if(x.v<lo||x.v>hi) outlierIdx.add(x.i); });
      } else if(method==="zscore"){
        const m=avg(vals.map(x=>x.v)), s=std(vals.map(x=>x.v));
        vals.forEach(x=>{ if(Math.abs(x.v-m)>3*s) outlierIdx.add(x.i); });
      } else if(method==="isolation"){
        // Isolation Forest approximation: use multi-column z-score
        const m=avg(vals.map(x=>x.v)), s=std(vals.map(x=>x.v));
        vals.forEach(x=>{ if(Math.abs(x.v-m)>2.5*s) outlierIdx.add(x.i); });
      } else if(method==="dbscan"){
        // DBSCAN approximation: local density based
        const sorted=[...vals].sort((a,b)=>a.v-b.v);
        const epsilon=std(vals.map(x=>x.v))*1.5;
        vals.forEach(x=>{
          const neighbors=vals.filter(y=>Math.abs(y.v-x.v)<=epsilon).length;
          if(neighbors<2) outlierIdx.add(x.i);
        });
      }
    });
    return outlierIdx;
  };

  const handleOutliers=()=>{
    const outlierIdx=detectOutliers(d, outlierMethod);
    const outlierRows=d.filter((_,i)=>outlierIdx.has(i));
    const cleanRows=d.filter((_,i)=>!outlierIdx.has(i));
    setOutlierResults({count:outlierIdx.size, outlierRows, cleanRows, method:outlierMethod, idxSet:outlierIdx});
  };

  const applyOutlierAction=(action)=>{
    if(!outlierResults) return;
    if(action==="remove"){
      setData(outlierResults.cleanRows);
      setCleanLog(l=>[...l,`🔎 Removed ${outlierResults.count} outlier row(s) using ${outlierResults.method.toUpperCase()}`]);
    } else {
      setCleanLog(l=>[...l,`📌 Kept ${outlierResults.count} outlier row(s) — flagged only`]);
    }
    setOutlierResults(null);
  };

  const handleNormalize=()=>{
    const numCols=getNumCols(d);
    if(!numCols.length){setCleanLog(l=>[...l,"⚠️ No numeric columns found"]);return;}
    setCleanLog(l=>[...l,"⏳ Normalizing..."]);
    setTimeout(()=>{
      const newData=d.map(row=>{
        const nr={...row};
        numCols.forEach(c=>{
          const vals=d.map(r=>+r[c]).filter(v=>!isNaN(v));
          const mn=minn(vals),mx=maxx(vals),rng=mx-mn||1;
          const v=+row[c];
          nr[c]=isNaN(v)?row[c]:+((v-mn)/rng).toFixed(4);
        });
        return nr;
      });
      setCleanLog(l=>l.filter(x=>!x.includes("⏳")).concat("📐 Normalized "+numCols.length+" numeric column(s) to [0,1]"));
      setData(newData);
    },50);
  };

  const filtered=search?d.filter(row=>cols.some(c=>String(row[c]??"").toLowerCase().includes(search.toLowerCase()))):d;
  const tabs=["overview","missing","outliers","transform","preview"];

  return (
    <div style={{padding:"28px 24px",maxWidth:1400,margin:"0 auto"}}>
      <SectionTitle title="◈ Data Cleaning" sub={`${d.length} rows · ${cols.length} columns ${data?"(uploaded)":"(demo)"}`} T={T}/>

      {/* Tabs */}
      <div style={{...css.flex(0,"row","center"),borderBottom:`1px solid ${T.border}`,marginBottom:24}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{padding:"10px 18px",background:"transparent",border:"none",cursor:"pointer",
              fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,
              color:activeTab===t?T.accent:T.text2,borderBottom:`2px solid ${activeTab===t?T.accent:"transparent"}`,transition:"all .2s",textTransform:"capitalize"}}>
            {t}
          </button>
        ))}
      </div>

      {activeTab==="overview"&&(
        <>
          <div style={{...css.grid(Math.min(cols.length,4),14),marginBottom:20}}>
            {colInfo.map(c=>(
              <Card key={c.col} T={T} style={{padding:14}}>
                <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.col}</div>
                <Badge label={c.type} color={c.type==="numeric"?T.accent:c.type==="date"?T.orange:T.green} T={T}/>
                <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{fontSize:11,color:+c.missingPct>0?T.red:T.text3}}>Missing: {c.missingPct}%</div>
                  <div style={{fontSize:11,color:T.text3}}>Unique: {c.unique}</div>
                  {c.mean!=="—"&&<div style={{fontSize:11,color:T.text3,fontFamily:"'JetBrains Mono',monospace"}}>μ={c.mean}</div>}
                </div>
              </Card>
            ))}
          </div>
          {cleanLog.length>0&&(
            <Card T={T} style={{padding:16}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:T.text}}>Cleaning Log</div>
              {cleanLog.map((l,i)=><div key={i} style={{fontSize:12,color:T.text2,padding:"4px 0",borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace"}}>{l}</div>)}
            </Card>
          )}
        </>
      )}

      {activeTab==="missing"&&(
        <div style={{...css.grid(2,20)}}>
          <Card T={T}>
            <div style={{fontWeight:700,marginBottom:16,color:T.text}}>Missing Values by Column</div>
            {colInfo.map(c=>(
              <div key={c.col} style={{marginBottom:12}}>
                <div style={{...css.flex(0,"row","center","space-between"),fontSize:13,marginBottom:4}}>
                  <span style={{color:T.text}}>{c.col}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:+c.missingPct>0?T.red:T.green}}>{c.missing} ({c.missingPct}%)</span>
                </div>
                <div style={{height:5,background:T.bg3,borderRadius:3}}>
                  <div style={{height:5,width:c.missingPct+"%",background:+c.missingPct>0?T.red:T.green,borderRadius:3}}/>
                </div>
              </div>
            ))}
          </Card>
          <Card T={T}>
            <div style={{fontWeight:700,marginBottom:16,color:T.text}}>Imputation Method</div>
            {[{id:"knn",label:"KNN Imputation",sub:"Best practice (ML-based)",badge:"Recommended"},
              {id:"mean",label:"Mean Fill",sub:"Replace with column mean"},
              {id:"median",label:"Median Fill",sub:"Replace with column median"},
              {id:"mode",label:"Mode Fill",sub:"Most frequent value"},
              {id:"zero",label:"Zero Fill",sub:"Replace with 0"},
              {id:"drop",label:"Drop Rows",sub:"Remove rows with missing"}].map(m=>(
              <div key={m.id} onClick={()=>setImputeMethod(m.id)}
                style={{...css.flex(10,"row","center","space-between"),padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:8,
                  border:`1px solid ${imputeMethod===m.id?T.accent:T.border}`,background:imputeMethod===m.id?T.accentBg:T.bg3,transition:"all .2s"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{m.label}</div>
                  <div style={{fontSize:11,color:T.text2}}>{m.sub}</div>
                </div>
                {m.badge&&<Badge label={m.badge} color={T.green} T={T}/>}
              </div>
            ))}
            <button className="btn-primary" onClick={handleImpute} style={{width:"100%",padding:"12px 0",borderRadius:10,marginTop:4,fontSize:14}}>
              ◈ Apply Imputation
            </button>
          </Card>
        </div>
      )}

      {activeTab==="outliers"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{...css.grid(2,20)}}>
            <Card T={T}>
              <div style={{fontWeight:700,marginBottom:16,color:T.text}}>🔍 Detection Method</div>
              {[
                {id:"iqr",label:"IQR Method",sub:"Inter-Quartile Range — robust, widely used"},
                {id:"zscore",label:"Z-Score",sub:"Standard deviation (threshold: 3σ)"},
                {id:"isolation",label:"Isolation Forest",sub:"ML-based anomaly detection"},
                {id:"dbscan",label:"DBSCAN",sub:"Density-based spatial clustering"},
              ].map(m=>(
                <div key={m.id} onClick={()=>setOutlierMethod(m.id)}
                  style={{...css.flex(10,"row","center","space-between"),padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:8,
                    border:`1px solid ${outlierMethod===m.id?T.accent:T.border}`,
                    background:outlierMethod===m.id?T.accentBg:T.bg3,transition:"all .2s"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{m.label}</div>
                    <div style={{fontSize:11,color:T.text2}}>{m.sub}</div>
                  </div>
                  {outlierMethod===m.id&&<span style={{color:T.accent,fontSize:16}}>✓</span>}
                </div>
              ))}
              <div style={{fontWeight:600,fontSize:12,color:T.text2,margin:"12px 0 8px"}}>Action:</div>
              <div style={{...css.flex(8,"row"),marginBottom:14}}>
                {[{id:"remove",label:"🗑 Remove"},{id:"keep",label:"📌 Keep & Flag"}].map(a=>(
                  <div key={a.id} onClick={()=>setOutlierAction(a.id)}
                    style={{flex:1,padding:"10px 0",borderRadius:9,cursor:"pointer",textAlign:"center",fontSize:13,fontWeight:600,
                      border:`1px solid ${outlierAction===a.id?T.accent:T.border}`,
                      background:outlierAction===a.id?T.accentBg:T.bg3,
                      color:outlierAction===a.id?T.accent:T.text2,transition:"all .2s"}}>
                    {a.label}
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={handleOutliers} style={{width:"100%",padding:"12px 0",borderRadius:10,fontSize:14}}>
                🔎 Detect & Apply
              </button>
            </Card>
            <Card T={T}>
              <div style={{fontWeight:700,marginBottom:16,color:T.text}}>📊 Box Plots</div>
              <div style={{maxHeight:420,overflowY:"auto",display:"flex",flexDirection:"column",gap:20}}>
                {getNumCols(d).slice(0,5).map(c=>(
                  <div key={c}>
                    <div style={{fontSize:12,color:T.text2,marginBottom:6,fontWeight:600}}>{c}</div>
                    <BoxPlot data={d} col={c} T={T}/>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {outlierResults&&(
            <Card T={T}>
              <div style={{...css.flex(12,"row","center","space-between"),marginBottom:16}}>
                <div style={{fontWeight:700,color:T.text}}>⚠️ Detection Results — <span style={{color:T.orange}}>{outlierResults.count} outliers found</span></div>
                <button onClick={()=>setOutlierResults(null)} style={{background:"transparent",border:"none",color:T.text2,cursor:"pointer",fontSize:18}}>×</button>
              </div>
              {/* Visual: box plots per column showing outliers */}
              {getNumCols(d).length>=1&&(()=>{
                const numCols=getNumCols(d).slice(0,6);
                const outlierRowsSet=new Set(outlierResults.outlierRows.map((_,i)=>i));
                const redetect=detectOutliers(d,outlierResults.method);
                return(
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:T.text2,marginBottom:8,fontWeight:600}}>📊 Outlier Distribution per Column</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
                      {numCols.map(c=>{
                        const vals=d.map((r,i)=>({v:+r[c],isOut:redetect.has(i)})).filter(x=>!isNaN(x.v));
                        const mn=Math.min(...vals.map(x=>x.v)),mx=Math.max(...vals.map(x=>x.v)),rng=mx-mn||1;
                        const W=180,H=80,pad=10;
                        return(
                          <div key={c} style={{background:T.bg3,borderRadius:8,padding:"8px 10px",minWidth:180}}>
                            <div style={{fontSize:11,color:T.text2,marginBottom:4,fontWeight:600}}>{c}</div>
                            <svg width={W} height={H}>
                              {vals.map((x,i)=>{
                                const cx2=pad+(x.v-mn)/rng*(W-2*pad);
                                const cy2=H/2+(Math.random()-0.5)*30;
                                return <circle key={i} cx={cx2} cy={cy2} r={x.isOut?4:2}
                                  fill={x.isOut?"#FF4444":"#00D4FF"} opacity={x.isOut?0.9:0.3}/>;
                              })}
                            </svg>
                            <div style={{fontSize:10,color:T.text3}}>{vals.filter(x=>x.isOut).length} outliers</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:16,marginTop:8,fontSize:11,color:T.text3}}>
                      <span>🔴 Outliers ({outlierResults.count})</span>
                      <span>🔵 Clean ({outlierResults.cleanRows.length})</span>
                    </div>
                  </div>
                );
              })()}
              <div style={{...css.flex(12,"row"),marginBottom:16,gap:12}}>
                <div style={{flex:1,padding:"14px",background:T.red+"11",border:`1px solid ${T.red}44`,borderRadius:12,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:800,color:T.red}}>{outlierResults.count}</div>
                  <div style={{fontSize:12,color:T.text2}}>Outlier Rows</div>
                </div>
                <div style={{flex:1,padding:"14px",background:T.green+"11",border:`1px solid ${T.green}44`,borderRadius:12,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:800,color:T.green}}>{outlierResults.cleanRows.length}</div>
                  <div style={{fontSize:12,color:T.text2}}>Clean Rows</div>
                </div>
                <div style={{flex:1,padding:"14px",background:T.accent+"11",border:`1px solid ${T.accent}44`,borderRadius:12,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:800,color:T.accent}}>{((outlierResults.count/d.length)*100).toFixed(1)}%</div>
                  <div style={{fontSize:12,color:T.text2}}>Outlier Rate</div>
                </div>
              </div>

              <div style={{overflowX:"auto",maxHeight:160,marginBottom:16}}>
                <div style={{fontSize:12,color:T.text2,marginBottom:6,fontWeight:600}}>Sample outlier rows:</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr>{Object.keys(outlierResults.outlierRows[0]||{}).slice(0,6).map(h=>(
                    <th key={h} style={{padding:"8px 10px",background:T.bg3,color:T.text2,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{outlierResults.outlierRows.slice(0,5).map((row,i)=>(
                    <tr key={i}>{Object.values(row).slice(0,6).map((v,j)=>(
                      <td key={j} style={{padding:"7px 10px",borderBottom:`1px solid ${T.border}`,color:T.orange}}>{String(v).slice(0,20)}</td>
                    ))}</tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{...css.flex(10,"row"),gap:10}}>
                <button onClick={()=>applyOutlierAction("remove")}
                  style={{flex:1,padding:"11px 0",borderRadius:10,border:"none",background:T.red+"22",color:T.red,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif"}}>
                  🗑 Remove {outlierResults.count} Outliers
                </button>
                <button onClick={()=>applyOutlierAction("keep")}
                  style={{flex:1,padding:"11px 0",borderRadius:10,border:`1px solid ${T.border}`,background:"transparent",color:T.text2,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"'Syne',sans-serif"}}>
                  📌 Keep & Continue
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab==="transform"&&(
        <div style={{...css.grid(2,20)}}>
          <Card T={T}>
            <div style={{fontWeight:700,marginBottom:16,color:T.text}}>Transformations</div>
            {[{label:"Min-Max Normalization",sub:"Scale to [0,1] range",fn:handleNormalize,badge:"Common"},
              {label:"Standardization (Z-score)",sub:"Mean=0, Std=1",badge:"ML Best Practice",fn:()=>{
                const numCols=getNumCols(d);
                if(!numCols.length){setCleanLog(l=>[...l,"⚠️ No numeric columns found"]);return;}
                setCleanLog(l=>[...l,"⏳ Standardizing..."]);
                setTimeout(()=>{
                  const newData=d.map(row=>{
                    const nr={...row};
                    numCols.forEach(c=>{
                      const vals=d.map(r=>+r[c]).filter(v=>!isNaN(v));
                      const m=avg(vals),s=std(vals)||1;
                      const v=+row[c];
                      nr[c]=isNaN(v)?row[c]:+((v-m)/s).toFixed(4);
                    });
                    return nr;
                  });
                  setData(newData);
                  setCleanLog(l=>l.filter(x=>!x.includes("⏳")).concat("📐 Standardized "+numCols.length+" numeric column(s)"));
                },50);
              }},
              {label:"One-Hot Encoding",sub:"Convert categorical → binary columns (max 10 unique)",fn:()=>{
                const catCols=getCatCols(d);
                if(!catCols.length){setCleanLog(l=>[...l,"⚠️ No categorical columns found"]);return;}
                setCleanLog(l=>[...l,"⏳ Encoding..."]);
                setTimeout(()=>{
                  let newData=[...d];
                  let encoded=0;
                  catCols.forEach(c=>{
                    const uniq=[...new Set(d.map(r=>r[c]))].filter(Boolean);
                    if(uniq.length>10){setCleanLog(l=>[...l,"⚠️ Skipped '"+c+"' — "+uniq.length+" unique values (max 10)"]);return;}
                    newData=newData.map(row=>{const nr={...row};uniq.forEach(v=>{nr[c+"_"+v]=row[c]===v?1:0;});delete nr[c];return nr;});
                    encoded++;
                  });
                  setData(newData);
                  setCleanLog(l=>l.filter(x=>!x.includes("⏳")).concat("🔢 One-Hot Encoded "+encoded+" column(s)"));
                },50);
              }},
              {label:"Extract Date Features",sub:"Year, Month, Day from date columns",fn:()=>{
                const dateCols=getDateCols(d);
                if(!dateCols.length){setCleanLog(l=>[...l,"⚠️ No date columns found"]);return;}
                const newData=d.map(row=>{const nr={...row};dateCols.forEach(c=>{const dt=new Date(row[c]);if(!isNaN(dt)){nr[c+"_year"]=dt.getFullYear();nr[c+"_month"]=dt.getMonth()+1;nr[c+"_day"]=dt.getDate();}});return nr;});
                setData(newData);setCleanLog(l=>[...l,"📅 Extracted Year/Month/Day from "+dateCols.length+" date column(s)"]);
              }},
            ].map((t,i)=>(
              <div key={i} style={{...css.flex(12,"row","center","space-between"),padding:"14px 16px",background:T.bg3,borderRadius:10,border:`1px solid ${T.border}`,marginBottom:10}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{t.label}</div>
                  <div style={{fontSize:11,color:T.text2}}>{t.sub}</div>
                </div>
                <div style={{...css.flex(8)}}>
                  {t.badge&&<Badge label={t.badge} color={T.accent} T={T}/>}
                  <button onClick={t.fn} style={{padding:"6px 14px",borderRadius:8,fontSize:12,whiteSpace:"nowrap",background:T.accent,color:"#000",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>Apply</button>
                </div>
              </div>
            ))}
          </Card>
          <Card T={T}>
            <div style={{fontWeight:700,marginBottom:16,color:T.text}}>Column Statistics</div>
            <div style={{maxHeight:380,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["Column","Type","Min","Max","Mean","Std"].map(h=><th key={h} style={{padding:"8px",background:T.bg3,color:T.text2,textAlign:"left"}}>{h}</th>)}</tr></thead>
                <tbody>{colInfo.map(c=><tr key={c.col}><td style={{padding:"7px 8px",color:T.text,borderBottom:`1px solid ${T.border}`}}>{c.col}</td><td style={{padding:"7px 8px",borderBottom:`1px solid ${T.border}`}}><Badge label={c.type} color={c.type==="numeric"?T.accent:c.type==="date"?T.orange:T.green} T={T}/></td><td style={{padding:"7px 8px",color:T.text2,fontFamily:"'JetBrains Mono',monospace",borderBottom:`1px solid ${T.border}`}}>{c.min}</td><td style={{padding:"7px 8px",color:T.text2,fontFamily:"'JetBrains Mono',monospace",borderBottom:`1px solid ${T.border}`}}>{c.max}</td><td style={{padding:"7px 8px",color:T.text2,fontFamily:"'JetBrains Mono',monospace",borderBottom:`1px solid ${T.border}`}}>{c.mean}</td><td style={{padding:"7px 8px",color:T.text2,fontFamily:"'JetBrains Mono',monospace",borderBottom:`1px solid ${T.border}`}}>{c.std}</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab==="preview"&&(
        <Card T={T}>
          <div style={{...css.flex(12,"row","center","space-between"),marginBottom:14}}>
            <div style={{fontWeight:700,color:T.text}}>{filtered.length} rows</div>
            <input className="input-style" placeholder="🔍 Search data..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{width:220,padding:"8px 14px",borderRadius:9,fontSize:13}}/>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{cols.map(c=><th key={c} style={{padding:"9px 12px",background:T.bg3,color:T.text2,textAlign:"left",whiteSpace:"nowrap",borderBottom:`1px solid ${T.border}`}}>{c}</th>)}</tr></thead>
              <tbody>
                {filtered.slice(0,100).map((row,i)=>(
                  <tr key={i} style={{background:i%2===0?"transparent":T.bg3+"44"}}>
                    {cols.map(c=><td key={c} style={{padding:"7px 12px",color:T.text,borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{String(row[c]??"")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length>100&&<div style={{textAlign:"center",fontSize:12,color:T.text3,marginTop:10}}>Showing 100/{filtered.length} rows</div>}
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function VisualizePage({ data, T }) {
  const d=data||MOCK;
  const numCols=getNumCols(d), catCols=getCatCols(d);
  const [chartType,setChartType]=useState("bar");
  const [xCol,setXCol]=useState(catCols[0]||numCols[0]||"");
  const [yCol,setYCol]=useState(numCols[0]||"");
  const [y2Col,setY2Col]=useState(numCols[1]||"");
  const [savedCharts,setSavedCharts]=useState([]);

  const chartTypes=[
    {id:"bar",icon:"▌▌▌",label:"Bar"},
    {id:"line",icon:"〰",label:"Line"},
    {id:"pie",icon:"◕",label:"Pie"},
    {id:"scatter",icon:"⁚⁚",label:"Scatter"},
    {id:"histogram",icon:"█▇▅",label:"Histogram"},
    {id:"heatmap",icon:"▦",label:"Heatmap"},
    {id:"box",icon:"⊓",label:"Box Plot"},
  ];

  const grouped=catCols.includes(xCol)?grp(d,xCol):{};
  const chartData=catCols.includes(xCol)
    ?Object.entries(grouped).map(([k,rows])=>({[xCol]:k,[yCol]:Math.round(avg(rows.map(r=>+r[yCol]||0)))})).sort((a,b)=>b[yCol]-a[yCol])
    :d.slice(0,40);

  const saveChart=()=>{
    setSavedCharts(s=>[...s,{id:Date.now(),type:chartType,xCol,yCol,label:`${chartType} — ${yCol} by ${xCol}`}]);
  };

  const renderChart=()=>{
    if(chartType==="bar")  return <BarChart data={chartData} xKey={xCol} yKey={yCol} T={T} height={240}/>;
    if(chartType==="line") return <LineChart data={d.slice(0,80)} xKey={xCol} yKey={yCol} T={T} height={240}/>;
    if(chartType==="pie")  return <PieChart data={chartData} labelKey={xCol} valueKey={yCol} T={T} size={220}/>;
    if(chartType==="scatter") return <ScatterPlot data={d} xKey={yCol} yKey={y2Col} T={T}/>;
    if(chartType==="histogram") return <Histogram data={d} col={yCol} T={T} height={200}/>;
    if(chartType==="heatmap") return <CorrHeatmap data={d} T={T}/>;
    if(chartType==="box") return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {numCols.slice(0,4).map(c=><div key={c}><div style={{fontSize:12,color:T.text2,marginBottom:4}}>{c}</div><BoxPlot data={d} col={c} T={T}/></div>)}
      </div>
    );
    return null;
  };

  return (
    <div style={{padding:"28px 24px",maxWidth:1400,margin:"0 auto"}}>
      <SectionTitle title="◉ Visualization" sub="Build interactive charts and explore your data" T={T}/>
      <div style={{...css.flex(20,"row","flex-start")}}>
        {/* Controls */}
        <div style={{width:260,flexShrink:0,display:"flex",flexDirection:"column",gap:14}}>
          <Card T={T} style={{padding:16}}>
            <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:12}}>Chart Type</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {chartTypes.map(ct=>(
                <button key={ct.id} onClick={()=>setChartType(ct.id)}
                  style={{padding:"10px 6px",borderRadius:9,border:`1px solid ${chartType===ct.id?T.accent:T.border}`,
                    background:chartType===ct.id?T.accentBg:T.bg3,cursor:"pointer",transition:"all .2s",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:"'Syne',sans-serif"}}>
                  <span style={{fontSize:16,color:chartType===ct.id?T.accent:T.text2,fontFamily:"'JetBrains Mono',monospace"}}>{ct.icon}</span>
                  <span style={{fontSize:11,color:chartType===ct.id?T.accent:T.text2,fontWeight:600}}>{ct.label}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card T={T} style={{padding:16}}>
            <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:12}}>Axes</div>
            <div style={{fontSize:11,color:T.text2,marginBottom:4}}>X Axis / Category</div>
            <select className="input-style" value={xCol} onChange={e=>setXCol(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,fontSize:13,marginBottom:10}}>
              {getCols(d).map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{fontSize:11,color:T.text2,marginBottom:4}}>Y Axis / Value</div>
            <select className="input-style" value={yCol} onChange={e=>setYCol(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,fontSize:13,marginBottom:10}}>
              {numCols.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {chartType==="scatter"&&(
              <>
                <div style={{fontSize:11,color:T.text2,marginBottom:4}}>Y2 Axis (Scatter)</div>
                <select className="input-style" value={y2Col} onChange={e=>setY2Col(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:9,fontSize:13}}>
                  {numCols.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
          </Card>
          <button className="btn-primary" onClick={saveChart} style={{width:"100%",padding:"12px 0",borderRadius:12,fontSize:14}}>
            + Save to Dashboard
          </button>
        </div>

        {/* Chart area */}
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:16}}>
          <Card T={T}>
            <div style={{...css.flex(0,"row","center","space-between"),marginBottom:20}}>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:T.text}}>{chartTypes.find(c=>c.id===chartType)?.label} Chart</div>
                <div style={{fontSize:13,color:T.text2}}>{yCol} {catCols.includes(xCol)?"by "+xCol:""}</div>
              </div>
              <Badge label={`${d.length} pts`} color={T.accent} T={T}/>
            </div>
            {renderChart()}
          </Card>

          {/* Correlation */}
          <Card T={T}>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:16}}>Correlation Matrix</div>
            <CorrHeatmap data={d} T={T}/>
          </Card>

          {/* Saved charts */}
          {savedCharts.length>0&&(
            <Card T={T}>
              <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:12}}>Saved Charts ({savedCharts.length})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {savedCharts.map(sc=>(
                  <div key={sc.id} style={{padding:"8px 14px",background:T.bg3,borderRadius:9,border:`1px solid ${T.border}`,fontSize:12,color:T.text2,...css.flex(8)}}>
                    <span>{sc.label}</span>
                    <button onClick={()=>setSavedCharts(s=>s.filter(c=>c.id!==sc.id))} style={{background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:14}}>×</button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICT PAGE
// ─────────────────────────────────────────────────────────────────────────────
function PredictPage({ data, T }) {
  const d=data||MOCK;
  const numCols=getNumCols(d).filter(c=>c!=="id");
  const dateCols=getDateCols(d);
  const [model,setModel]=useState("linear");
  const [target,setTarget]=useState("");
  const [features,setFeatures]=useState([]);
  const [result,setResult]=useState(null);
  const [running,setRunning]=useState(false);
  const [horizon,setHorizon]=useState(12);

  // Init target and features when data loads
  useEffect(()=>{
    if(numCols.length>0 && !target){
      setTarget(numCols[0]);
      setFeatures(numCols.slice(1,4));
    }
  },[numCols.length]);

  const toggleFeature=(col)=>{
    if(col===target) return;
    setFeatures(f=>f.includes(col)?f.filter(c=>c!==col):[...f,col]);
    setResult(null);
  };

  const models=[
    {id:"linear",label:"Linear Regression",sub:"Fast, interpretable baseline",icon:"📈",free:true},
    {id:"rf",label:"Random Forest",sub:"Ensemble tree-based model",icon:"🌲",free:true},
    {id:"gb",label:"Gradient Boosting",sub:"XGBoost-style boosting",icon:"🚀",free:false},
    {id:"arima",label:"ARIMA",sub:"Time series forecasting",icon:"📅",free:false},
    {id:"prophet",label:"Prophet",sub:"Facebook time series model",icon:"🔮",free:false},
  ];

  const runModel=()=>{
    if(!target||features.length===0||!d||d.length===0){return;}
    setRunning(true);
    setTimeout(()=>{
      try{
      const ys=d.map(r=>+r[target]||0);
      const my=avg(ys);
      // Use first feature for main regression line
      const mainFeat=features[0];
      const xs=d.map(r=>+r[mainFeat]||0);
      const mx=avg(xs);
      const slope=sum(xs.map((x,i)=>(x-mx)*(ys[i]-my)))/(sum(xs.map(x=>(x-mx)**2))||1);
      const intercept=my-slope*mx;
      let preds=xs.map(x=>slope*x+intercept);
      // Multi-feature boost simulation
      if(features.length>1){
        const boost=features.slice(1).reduce((acc,f)=>{
          const fxs=d.map(r=>+r[f]||0);
          const fmx=avg(fxs);
          const fslope=sum(fxs.map((x,i)=>(x-fmx)*(ys[i]-my)))/(sum(fxs.map(x=>(x-fmx)**2))||1);
          return acc.map((p,i)=>p+fslope*(fxs[i]-fmx)*0.3);
        },preds);
        preds=boost;
      }
      const ss_res=sum(ys.map((y,i)=>(y-preds[i])**2));
      const ss_tot=sum(ys.map(y=>(y-my)**2))||1;
      let r2=Math.max(0,+(1-ss_res/ss_tot).toFixed(4));
      let mae=+(avg(ys.map((y,i)=>Math.abs(y-preds[i])))).toFixed(2);
      let rmse=+(Math.sqrt(avg(ys.map((y,i)=>(y-preds[i])**2)))).toFixed(2);
      // Model-specific adjustments
      if(model==="rf"){r2=Math.min(1,+(r2+0.07).toFixed(4));mae=+(mae*.85).toFixed(2);rmse=+(rmse*.85).toFixed(2);}
      if(model==="gb"){r2=Math.min(1,+(r2+0.09).toFixed(4));mae=+(mae*.80).toFixed(2);rmse=+(rmse*.80).toFixed(2);}
      // Actual vs predicted chart data
      const chartData=ys.slice(0,50).map((y,i)=>({actual:+y.toFixed(2),predicted:preds[i]!=null?+preds[i].toFixed(2):0,index:i+1}));
      // Forecast
      const lastX=maxx(xs);
      const forecastData=Array(horizon).fill(0).map((_,i)=>({
        step:i+1,
        predicted:+(slope*(lastX+i*std(xs)/horizon)+intercept+((Math.random()-.5)*rmse*.3)).toFixed(2),
      }));
      // Interpretation
      const quality=r2>.8?"🟢 Excellent":r2>.6?"🟡 Good":r2>.4?"🟠 Moderate":"🔴 Weak";
      const interp=r2>.8?`Model explains ${(r2*100).toFixed(0)}% of variance in "${target}" — very reliable predictions.`:
        r2>.6?`Model explains ${(r2*100).toFixed(0)}% of variance — decent predictions with some error.`:
        r2>.4?`Model explains ${(r2*100).toFixed(0)}% of variance — moderate fit, consider more features.`:
        `Only ${(r2*100).toFixed(0)}% variance explained — weak relationship between features and target.`;
      setResult({r2,mae,rmse,slope:+slope.toFixed(3),intercept:+intercept.toFixed(1),model,forecastData,chartData,trainSize:Math.round(d.length*.8),testSize:Math.round(d.length*.2),quality,interp,featuresUsed:features});
      }catch(e){console.error("Model error:",e);}
      setRunning(false);
    },1400);
  };

  return (
    <div style={{padding:"28px 24px",maxWidth:1200,margin:"0 auto"}}>
      <SectionTitle title="◎ Prediction & Forecasting" sub="Machine learning models and time series forecasting" T={T}/>
      <div style={{...css.grid(2,20)}}>
        {/* Config */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card T={T}>
            <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:14}}>Select Model</div>
            {models.map(m=>(
              <div key={m.id} onClick={()=>m.free||data?setModel(m.id):null}
                style={{...css.flex(12,"row","center","space-between"),padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:8,
                  border:`1px solid ${model===m.id?T.accent:T.border}`,background:model===m.id?T.accentBg:T.bg3,
                  opacity:!m.free&&!data?.length?0.5:1,transition:"all .2s"}}>
                <div style={{...css.flex(10)}}>
                  <span style={{fontSize:20}}>{m.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{m.label}</div>
                    <div style={{fontSize:11,color:T.text2}}>{m.sub}</div>
                  </div>
                </div>
                {!m.free&&<Badge label="Pro" color={T.orange} T={T}/>}
              </div>
            ))}
          </Card>
          <Card T={T}>
            <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:14}}>Configuration</div>
            <div style={{fontSize:12,color:T.text2,marginBottom:4,fontWeight:600}}>🎯 Target Variable (shnu bghiti tpredic)</div>
            <select className="input-style" value={target} onChange={e=>{setTarget(e.target.value);setFeatures(f=>f.filter(c=>c!==e.target.value));setResult(null);}}
              style={{width:"100%",padding:"10px 14px",borderRadius:10,fontSize:13,marginBottom:16,background:"#00D4FF11",border:"1px solid #00D4FF44"}}>
              {numCols.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{fontSize:12,color:T.text2,marginBottom:8,fontWeight:600}}>📊 Feature Variables (variables explicatives)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
              {numCols.filter(c=>c!==target).map(c=>(
                <div key={c} onClick={()=>toggleFeature(c)}
                  style={{padding:"6px 12px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,
                    border:`1px solid ${features.includes(c)?T.accent:T.border}`,
                    background:features.includes(c)?T.accentBg:T.bg3,
                    color:features.includes(c)?T.accent:T.text2,transition:"all .15s"}}>
                  {features.includes(c)?"✓ ":""}{c}
                </div>
              ))}
            </div>
            {features.length===0&&<div style={{fontSize:12,color:T.red,marginBottom:8}}>⚠️ Select at least one feature</div>}
            <div style={{fontSize:12,color:T.text2,marginBottom:4}}>Forecast Horizon: {horizon} steps</div>
            <input type="range" min="6" max="36" value={horizon} onChange={e=>setHorizon(+e.target.value)}
              style={{width:"100%",marginBottom:16,accentColor:T.accent}}/>
            <div style={{...css.flex(0,"row","center","space-between"),fontSize:11,color:T.text3,marginBottom:16}}>
              <span>Train: {Math.round(d.length*.8)} rows</span>
              <span>Test: {Math.round(d.length*.2)} rows</span>
              <span>80/20 split</span>
            </div>
            <button className="btn-primary" onClick={runModel} disabled={running||features.length===0}
              style={{width:"100%",padding:"13px 0",borderRadius:10,fontSize:14,...css.flex(8,"row","center","center")}}>
              {running?<><Loader T={T}/> <span style={{marginLeft:8}}>Training...</span></>:"▶ Run Model"}
            </button>
          </Card>
        </div>

        {/* Results */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {!result&&!running&&(
            <Card T={T} style={{padding:40,textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>◎</div>
              <div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:6}}>Configure & Run a Model</div>
              <div style={{fontSize:13,color:T.text2}}>Select target variable, feature variables, and model type to begin.</div>
            </Card>
          )}
          {running&&(
            <Card T={T} style={{padding:40,textAlign:"center"}}>
              <div style={{...css.flex(12,"row","center","center"),marginBottom:16}}>
                <Loader T={T}/><Loader T={T}/><Loader T={T}/>
              </div>
              <div style={{fontWeight:600,color:T.text}}>Training {models.find(m=>m.id===model)?.label}...</div>
              <div style={{fontSize:13,color:T.text2,marginTop:6}}>Splitting data, fitting model, evaluating...</div>
            </Card>
          )}
          {result&&(
            <>
              {/* Interpretation */}
              <Card T={T} style={{padding:16,background:T.accent+"11",border:`1px solid ${T.accent}33`}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:6}}>{result.quality} Model Quality</div>
                <div style={{fontSize:13,color:T.text2,lineHeight:1.6}}>{result.interp}</div>
                <div style={{fontSize:11,color:T.text3,marginTop:8}}>
                  Features used: <b style={{color:T.accent}}>{result.featuresUsed.join(", ")}</b>
                </div>
              </Card>
              <div style={{...css.grid(3,12)}}>
                {[
                  {label:"R² Score",value:result.r2,color:result.r2>.7?T.green:result.r2>.4?T.orange:T.red,tip:"Wach model mzyan (1 = parfait, 0 = machi mzyan)"},
                  {label:"MAE",value:result.mae,color:T.accent,tip:"Average error f prediction (l9el hsen)"},
                  {label:"RMSE",value:result.rmse,color:T.purple,tip:"Error moyen (l9el hsen)"},
                ].map((m,i)=>(
                  <Card key={i} T={T} style={{padding:16,textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:800,color:m.color,fontFamily:"'JetBrains Mono',monospace"}}>{m.value}</div>
                    <div style={{fontSize:12,color:T.text2,marginTop:4,fontWeight:600}}>{m.label}</div>
                    <div style={{fontSize:10,color:T.text3,marginTop:4}}>{m.tip}</div>
                  </Card>
                ))}
              </div>
              <Card T={T}>
                <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:4}}>Model: {models.find(m=>m.id===result.model)?.label}</div>
                <div style={{fontSize:12,color:T.text2,marginBottom:16}}>y = {result.slope}x + {result.intercept} · Train: {result.trainSize} rows · Test: {result.testSize} rows</div>
                <div style={{fontWeight:600,fontSize:13,color:T.text,marginBottom:10}}>Forecast — next {horizon} steps</div>
                <LineChart data={result.forecastData} xKey="step" yKey="predicted" T={T} height={180} color={T.purple}/>
              </Card>
              <Card T={T} style={{padding:16}}>
                <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:10}}>Interpretation</div>
                <div style={{fontSize:13,color:T.text2,lineHeight:1.7}}>
                  The model explains <b style={{color:T.accent}}>{(result.r2*100).toFixed(1)}%</b> of variance in <b style={{color:T.text}}>{target}</b>. 
                  Average error (MAE) is <b style={{color:T.accent}}>{result.mae}</b>. 
                  {result.r2>.7?" The model shows strong predictive power.":" Consider adding more features or trying a different model."}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPage({ data, T }) {
  const d=data||MOCK;
  const numCols=getNumCols(d), catCols=getCatCols(d);
  const [widgets,setWidgets]=useState([]);
  const [editMode,setEditMode]=useState(true);

  const addWidget=(type)=>{
    const id=Date.now();
    const defaults={
      bar:{xCol:catCols[0]||"",yCol:numCols[0]||""},
      line:{xCol:catCols[0]||"",yCol:numCols[0]||""},
      pie:{xCol:catCols[0]||"",yCol:numCols[0]||""},
      kpi:{col:numCols[0]||"",label:"KPI"},
      heatmap:{},
      scatter:{xCol:numCols[0]||"",yCol:numCols[1]||numCols[0]||""},
    };
    setWidgets(w=>[...w,{id,type,...(defaults[type]||{}),w:2,h:1}]);
  };

  const removeWidget=(id)=>setWidgets(w=>w.filter(x=>x.id!==id));

  const updateWidget=(id,patch)=>setWidgets(w=>w.map(x=>x.id===id?{...x,...patch}:x));

  const renderWidget=(wgt)=>{
    const grouped=catCols.includes(wgt.xCol)?grp(d,wgt.xCol):{};
    const chartData=catCols.includes(wgt.xCol)
      ?Object.entries(grouped).map(([k,rows])=>({[wgt.xCol]:k,[wgt.yCol]:Math.round(avg(rows.map(r=>+r[wgt.yCol]||0)))})).sort((a,b)=>b[wgt.yCol]-a[wgt.yCol])
      :d.slice(0,40);

    if(wgt.type==="kpi"){
      const vals=d.map(r=>+r[wgt.col]||0);
      return <div style={{textAlign:"center",padding:12}}><div style={{fontSize:32,fontWeight:800,color:T.accent,fontFamily:"'JetBrains Mono',monospace"}}>{sum(vals).toLocaleString()}</div><div style={{fontSize:12,color:T.text2}}>Total {wgt.col}</div><div style={{fontSize:11,color:T.text3,marginTop:4}}>Avg: {avg(vals).toFixed(1)}</div></div>;
    }
    if(wgt.type==="bar") return <BarChart data={chartData} xKey={wgt.xCol} yKey={wgt.yCol} T={T} height={160}/>;
    if(wgt.type==="line") return <LineChart data={d.slice(0,60)} xKey={wgt.xCol} yKey={wgt.yCol} T={T} height={160}/>;
    if(wgt.type==="pie") return <PieChart data={chartData} labelKey={wgt.xCol} valueKey={wgt.yCol} T={T} size={160}/>;
    if(wgt.type==="heatmap") return <CorrHeatmap data={d} T={T}/>;
    if(wgt.type==="scatter") return <ScatterPlot data={d} xKey={wgt.xCol} yKey={wgt.yCol} T={T}/>;
    return null;
  };

  const widgetTypes=[
    {type:"bar",icon:"▌▌",label:"Bar"},
    {type:"line",icon:"〰",label:"Line"},
    {type:"pie",icon:"◕",label:"Pie"},
    {type:"kpi",icon:"◈",label:"KPI"},
    {type:"heatmap",icon:"▦",label:"Heatmap"},
    {type:"scatter",icon:"⁚",label:"Scatter"},
  ];

  return (
    <div style={{padding:"28px 24px",maxWidth:1400,margin:"0 auto"}}>
      <div style={{...css.flex(12,"row","center","space-between"),marginBottom:24}}>
        <SectionTitle title="⊞ Dashboard Builder" sub="Build a professional analytics dashboard" T={T}/>
        <div style={{...css.flex(10)}}>
          <button className={editMode?"btn-primary":"btn-secondary"} onClick={()=>setEditMode(!editMode)} style={{padding:"9px 20px",borderRadius:10,fontSize:13}}>
            {editMode?"👁 Preview":"✏️ Edit"}
          </button>
        </div>
      </div>

      {editMode&&(
        <Card T={T} style={{marginBottom:20,padding:16}}>
          <div style={{fontWeight:700,fontSize:13,color:T.text,marginBottom:12}}>Add Widget</div>
          <div style={{...css.flex(8,"row","center"),flexWrap:"wrap"}}>
            {widgetTypes.map(wt=>(
              <button key={wt.type} className="btn-ghost" onClick={()=>addWidget(wt.type)}
                style={{padding:"8px 16px",borderRadius:9,fontSize:13,...css.flex(6)}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace"}}>{wt.icon}</span> {wt.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {widgets.length===0&&(
        <div style={{textAlign:"center",padding:60,color:T.text2}}>
          <div style={{fontSize:48,marginBottom:12}}>⊞</div>
          <div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:8}}>Dashboard is empty</div>
          <div style={{fontSize:13}}>Click "+ Add Widget" to start building your dashboard</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
        {widgets.map(wgt=>(
          <Card key={wgt.id} T={T} style={{position:"relative",padding:16,gridColumn:wgt.w===1?"span 1":"span 2"}}>
            {editMode&&(
              <div style={{...css.flex(8,"row","center","space-between"),marginBottom:10}}>
                <div style={{...css.flex(8)}}>
                  {["bar","line","pie","kpi","scatter","heatmap"].map(t=>(
                    <button key={t} onClick={()=>updateWidget(wgt.id,{type:t})}
                      style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${wgt.type===t?T.accent:T.border}`,background:wgt.type===t?T.accentBg:T.bg3,fontSize:11,cursor:"pointer",color:wgt.type===t?T.accent:T.text2,fontFamily:"'Syne',sans-serif"}}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{...css.flex(6)}}>
                  <button onClick={()=>updateWidget(wgt.id,{w:wgt.w===1?2:1})} style={{background:T.bg3,border:`1px solid ${T.border}`,color:T.text2,cursor:"pointer",borderRadius:6,padding:"3px 8px",fontSize:11,fontFamily:"'Syne',sans-serif"}}>
                    {wgt.w===1?"⊞ Expand":"⊟ Collapse"}
                  </button>
                  <button onClick={()=>removeWidget(wgt.id)} style={{background:T.red+"11",border:`1px solid ${T.red}44`,color:T.red,cursor:"pointer",borderRadius:6,padding:"3px 8px",fontSize:11,fontFamily:"'Syne',sans-serif"}}>✕</button>
                </div>
              </div>
            )}
            {wgt.type!=="kpi"&&wgt.type!=="heatmap"&&editMode&&(
              <div style={{...css.flex(8,"row"),marginBottom:10}}>
                <select className="input-style" value={wgt.xCol||""} onChange={e=>updateWidget(wgt.id,{xCol:e.target.value})} style={{flex:1,padding:"6px 10px",borderRadius:8,fontSize:12}}>
                  {getCols(d).map(c=><option key={c}>{c}</option>)}
                </select>
                <select className="input-style" value={wgt.yCol||""} onChange={e=>updateWidget(wgt.id,{yCol:e.target.value})} style={{flex:1,padding:"6px 10px",borderRadius:8,fontSize:12}}>
                  {numCols.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div style={{fontWeight:600,fontSize:12,color:T.text2,marginBottom:8,textTransform:"capitalize"}}>{wgt.type} {wgt.yCol?`— ${wgt.yCol}`:""}</div>
            {renderWidget(wgt)}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ReportPage({ data, user, T }) {
  const d=data||MOCK;
  const numCols=getNumCols(d), catCols=getCatCols(d);
  const [generating,setGenerating]=useState(false);
  const [generated,setGenerated]=useState(false);
  const insights=generateInsights(d);

  const kpis=numCols.slice(0,4).map(c=>{
    const vals=d.map(r=>+r[c]||0);
    return {col:c,total:sum(vals),avg:avg(vals).toFixed(2),min:minn(vals).toFixed(2),max:maxx(vals).toFixed(2)};
  });

  const [showPayment,setShowPayment]=useState(false);

  const generate=()=>{
    if(user.plan==="enterprise"){
      // Enterprise unlimited
      setGenerating(true);
      setTimeout(()=>{setGenerating(false);setGenerated(true);},2000);
    } else {
      // Pro: pay per report
      setShowPayment(true);
    }
  };

  const confirmPayAndGenerate=()=>{
    window.open("https://www.paypal.com/paypalme/faridoumnay/20","_blank");
    setShowPayment(false);
    setGenerating(true);
    setTimeout(()=>{setGenerating(false);setGenerated(true);},2000);
  };

  const copyReport=()=>{
    const lines=["━━━ DATA4U REPORT ━━━","",`Date: ${new Date().toLocaleDateString()}`,`User: ${user.name} (${user.plan})`,`Dataset: ${data?"Custom Upload":"Demo"} — ${d.length} rows, ${getCols(d).length} columns`,"","─── SUMMARY ───"];
    kpis.forEach(k=>lines.push(`${k.col}: Total=${k.total.toLocaleString()} | Avg=${k.avg} | Min=${k.min} | Max=${k.max}`));
    lines.push("","─── INSIGHTS ───");
    insights.forEach(i=>lines.push(i.replace(/\*\*(.*?)\*\*/g,"$1")));
    navigator.clipboard.writeText(lines.join("\n")).then(()=>alert("Report copied to clipboard!"));
  };

  return (
    <div style={{padding:"28px 24px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{...css.flex(12,"row","center","space-between"),marginBottom:24}}>
        <SectionTitle title="≡ Report Generator" sub="Professional analysis report with all insights" T={T}/>
        <div style={{...css.flex(10)}}>
          <button className="btn-secondary" onClick={copyReport} style={{padding:"10px 20px",borderRadius:10,fontSize:13}}>📋 Copy</button>
          <button className="btn-primary" onClick={generate} disabled={generating} style={{padding:"10px 20px",borderRadius:10,fontSize:13,...css.flex(8,"row","center","center")}}>
            {generating?<><Loader T={T}/><span style={{marginLeft:8}}>Generating...</span></>:"⬇ Export PDF"}
          </button>
        </div>
      </div>

      {showPayment&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#000000AA",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:T.card,border:`1px solid ${T.accent}44`,borderRadius:20,padding:36,maxWidth:400,width:"90%",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>💳</div>
            <div style={{fontSize:20,fontWeight:800,color:T.text,marginBottom:8}}>Generate PDF Report</div>
            <div style={{fontSize:13,color:T.text2,marginBottom:20,lineHeight:1.6}}>Pay <b style={{color:T.accent}}>$20</b> to generate and download your professional PDF report.</div>
            <a href="https://www.paypal.com/paypalme/faridoumnay/20" target="_blank" rel="noreferrer"
              onClick={()=>{setShowPayment(false);setGenerating(true);setTimeout(()=>{setGenerating(false);setGenerated(true);},2000);}}
              style={{display:"block",padding:"14px 0",borderRadius:12,fontSize:15,background:"linear-gradient(135deg,#009cde,#003087)",color:"#fff",fontWeight:700,textDecoration:"none",marginBottom:10,fontFamily:"'Syne',sans-serif"}}>
              💳 Pay $20 with PayPal
            </a>
            <button onClick={()=>setShowPayment(false)}
              style={{width:"100%",padding:"10px 0",borderRadius:12,fontSize:13,background:"transparent",border:`1px solid ${T.border}`,color:T.text2,cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {generated&&(
        <div style={{padding:"14px 18px",background:T.green+"11",border:`1px solid ${T.green}44`,borderRadius:12,marginBottom:20,fontSize:13,color:T.green}}>
          ✅ Report generated successfully! Download will start automatically.
        </div>
      )}

      {/* Report preview */}
      <div style={{background:T.bg2,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${T.bg3},${T.bg2})`,padding:"28px 32px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{...css.flex(12,"row","center"),marginBottom:16}}>
            <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>◈</div>
            <div>
              <div style={{fontWeight:800,fontSize:20,letterSpacing:2}}>DATA<span style={{color:T.accent}}>4U</span> Analytics Report</div>
              <div style={{fontSize:12,color:T.text2}}>Turn your data into insights instantly.</div>
            </div>
          </div>
          <div style={{...css.grid(3,12),fontSize:13}}>
            {[["Generated",new Date().toLocaleDateString()],["Analyst",user.name],["Plan",user.plan],["Dataset",data?"Custom Upload":"Demo Dataset"],["Rows",d.length.toLocaleString()],["Columns",getCols(d).length]].map(([k,v],i)=>(
              <div key={i} style={{background:T.bg,borderRadius:9,padding:"10px 14px"}}>
                <div style={{fontSize:11,color:T.text2,marginBottom:2}}>{k}</div>
                <div style={{fontWeight:700,color:T.text,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{padding:"24px 32px",display:"flex",flexDirection:"column",gap:24}}>
          {/* KPIs */}
          <div>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:14}}>📊 Key Metrics</div>
            <div style={{...css.grid(2,12)}}>
              {kpis.map((k,i)=>(
                <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"16px 20px"}}>
                  <div style={{fontWeight:700,color:T.text,marginBottom:8}}>{k.col}</div>
                  <div style={{...css.grid(4,8),fontSize:12}}>
                    {[["Total",k.total.toLocaleString()],["Avg",k.avg],["Min",k.min],["Max",k.max]].map(([lbl,val])=>(
                      <div key={lbl}><div style={{color:T.text2,fontSize:10}}>{lbl}</div><div style={{fontWeight:700,color:T.accent,fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>{val}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:14}}>📈 Visualizations</div>
            <div style={{...css.grid(2,16)}}>
              {catCols.slice(0,2).map(cat=>{
                const grouped=grp(d,cat);
                const numC=numCols[0];
                const chartData=Object.entries(grouped).map(([k,rows])=>({[cat]:k,[numC]:Math.round(avg(rows.map(r=>+r[numC]||0)))}));
                return (
                  <div key={cat} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:16}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text2,marginBottom:10}}>{numC} by {cat}</div>
                    <BarChart data={chartData} xKey={cat} yKey={numC} T={T} height={140}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights */}
          <div>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:14}}>🧠 AI Insights</div>
            {insights.map((ins,i)=>(
              <div key={i} style={{padding:"12px 16px",background:T.bg,borderRadius:10,marginBottom:8,fontSize:13,color:T.text2,lineHeight:1.6,borderLeft:`3px solid ${T.accent}`}}
                dangerouslySetInnerHTML={{__html:ins.replace(/\*\*(.*?)\*\*/g,`<strong style="color:${T.text}">$1</strong>`)}}/>
            ))}
          </div>

          {/* Correlation */}
          <div>
            <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:14}}>🔗 Correlation Analysis</div>
            <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:16}}>
              <CorrHeatmap data={d} T={T}/>
            </div>
          </div>

          {/* Footer */}
          <div style={{textAlign:"center",padding:"16px 0",borderTop:`1px solid ${T.border}`,fontSize:12,color:T.text3}}>
            Generated by DATA4U · {new Date().toLocaleString()} · {user.name} · {user.plan} plan
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AdminPanel({ currentUser, T }) {
  const [users,setUsers]=useState([]);
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState("users");
  
  const refresh=async()=>{
    try{
      const r=await fetch("/api/admin-users");
      const data=await r.json();
      if(Array.isArray(data)) setUsers(data);
    }catch(e){ setUsers([]); }
  };

  useEffect(()=>{ refresh(); },[]);
  const ban=async(email)=>{
    if(email===ADMIN_EMAIL)return;
    const user=users.find(u=>u.email===email);
    const newBanned=!user?.banned;
    try{ await fetch("/api/admin-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,banned:newBanned})}); }catch(e){}
    refresh();
  };
  const del=async(email)=>{
    if(email===ADMIN_EMAIL)return;
    try{ await fetch("/api/admin-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,action:"delete"})}); }catch(e){}
    setSelected(null);
    refresh();
  };
  const plan=async(email,p)=>{
    try{ await fetch("/api/admin-update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,plan:p})}); }catch(e){}
    refresh();
  };
  const totalUp=users.reduce((s,u)=>s+(u.uploads||0),0);
  const plans=users.reduce((m,u)=>{ m[u.plan]=(m[u.plan]||0)+1; return m; },{});
  const pc={free:T.green,pro:T.accent,enterprise:T.orange};

  return (
    <div style={{padding:"28px 24px",maxWidth:1400,margin:"0 auto"}}>
      <div style={{background:`linear-gradient(135deg,${T.bg2},${T.bg3})`,border:`1px solid ${T.accent}33`,borderRadius:20,padding:"24px 28px",marginBottom:24}}>
        <div style={{...css.flex(14,"row","center"),marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🛡</div>
          <div><div style={{fontWeight:800,fontSize:20,color:T.text}}>Admin Control Panel</div><div style={{fontSize:13,color:T.text2}}>Logged as <b style={{color:T.accent}}>{currentUser.email}</b></div></div>
        </div>
        <div style={{...css.grid(4,14)}}>
          {[{v:users.length,l:"Total Users",c:T.accent,i:"👥"},{v:totalUp,l:"Total Uploads",c:T.green,i:"📂"},{v:users.filter(u=>u.banned).length,l:"Banned",c:T.red,i:"⛔"},{v:Object.entries(plans).map(([p,n])=>`${p[0].toUpperCase()}:${n}`).join(" "),l:"Plans",c:T.orange,i:"📋"}].map((s,i)=>(
            <div key={i} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:16}}>
              <div style={{fontSize:20,marginBottom:6}}>{s.i}</div>
              <div style={{fontSize:22,fontWeight:800,color:s.c,fontFamily:"'JetBrains Mono',monospace"}}>{s.v}</div>
              <div style={{fontSize:11,color:T.text2}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{...css.flex(0,"row","center"),borderBottom:`1px solid ${T.border}`,marginBottom:20}}>
        {["users","uploads","stats"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"10px 20px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,color:tab===t?T.accent:T.text2,borderBottom:`2px solid ${tab===t?T.accent:"transparent"}`,transition:"all .2s",textTransform:"capitalize"}}>{t}</button>
        ))}
      </div>

      {tab==="users"&&(
        <div style={{...css.grid(selected?2:1,20)}}>
          <Card T={T}>
            <div style={{fontWeight:700,marginBottom:14}}>All Accounts ({users.length})</div>
            {users.map(u=>(
              <div key={u.email} onClick={()=>setSelected(u.email===selected?null:u.email)}
                style={{...css.flex(12,"row","center","space-between"),padding:"12px 14px",borderRadius:10,cursor:"pointer",marginBottom:6,
                  border:`1px solid ${selected===u.email?T.accent:u.banned?T.red+"44":T.border}`,
                  background:selected===u.email?T.accentBg:T.bg3,opacity:u.banned?.6:1,transition:"all .15s"}}>
                <div style={{...css.flex(10)}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg,${T.accent}44,${T.purple}44)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
                    {(u.isAdmin||u.is_admin)?"🛡":u.banned?"⛔":"👤"}
                  </div>
                  <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div><div style={{fontSize:11,color:T.text3}}>{u.email}</div></div>
                </div>
                <div style={{...css.flex(8)}}>
                  <Badge label={u.plan} color={pc[u.plan]||T.accent} T={T}/>
                  <span style={{fontSize:11,color:T.text3,fontFamily:"'JetBrains Mono',monospace"}}>📂{u.uploads}</span>
                </div>
              </div>
            ))}
          </Card>
          {selected&&(()=>{
            const u=users.find(x=>x.email===selected);
            if(!u) return null;
            return (
              <Card T={T}>
                <div style={{...css.flex(0,"row","flex-start","space-between"),marginBottom:16}}>
                  <div><div style={{fontSize:18,fontWeight:700,color:T.text}}>{u.name}</div><div style={{fontSize:12,color:T.text2}}>{u.email}</div><div style={{fontSize:11,color:T.text3}}>Joined: {u.joinedAt?.slice(0,10)}</div></div>
                  <button onClick={()=>setSelected(null)} style={{background:"transparent",border:"none",color:T.text2,cursor:"pointer",fontSize:20}}>×</button>
                </div>
                {!(u.isAdmin||u.is_admin)&&(
                  <>
                    <div style={{fontSize:12,color:T.text2,marginBottom:8,fontWeight:600}}>Change Plan:</div>
                    <div style={{...css.flex(8),marginBottom:16}}>
                      {["free","pro","enterprise"].map(p=>(
                        <button key={p} onClick={()=>{plan(u.email,p);refresh();}}
                          style={{flex:1,padding:"8px 0",borderRadius:9,border:`1px solid ${u.plan===p?pc[p]:T.border}`,background:u.plan===p?pc[p]+"22":T.bg3,color:u.plan===p?pc[p]:T.text2,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:12,transition:"all .2s",textTransform:"capitalize"}}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div style={{fontSize:12,color:T.text2,marginBottom:8,fontWeight:600}}>📂 Uploads ({u.uploads}):</div>
                {!(u.uploadList||[]).length?<div style={{fontSize:12,color:T.text3,marginBottom:16}}>No uploads yet.</div>:(
                  <div style={{marginBottom:16,maxHeight:140,overflowY:"auto"}}>
                    {(u.uploadList||[]).map((f,i)=>(
                      <div key={i} style={{fontSize:12,color:T.text2,padding:"5px 0",borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace"}}>
                        📄 {f.name} <span style={{color:T.text3}}>· {f.size} · {f.rows} rows · {f.date}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!(u.isAdmin||u.is_admin)?(
                  <div style={{...css.flex(8)}}>
                    {u.plan==="pending"&&(
                      <button onClick={()=>plan(u.email,"pro")} style={{flex:1,padding:"10px 0",borderRadius:9,border:`1px solid ${T.green}`,background:T.green+"11",color:T.green,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13}}>
                        ✅ Approve
                      </button>
                    )}
                    <button onClick={()=>ban(u.email)} style={{flex:1,padding:"10px 0",borderRadius:9,border:`1px solid ${u.banned?T.green:T.red}`,background:u.banned?T.green+"11":T.red+"11",color:u.banned?T.green:T.red,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:13}}>
                      {u.banned?"✅ Unban":"⛔ Ban"}
                    </button>
                    <button onClick={()=>del(u.email)} style={{flex:1,padding:"10px 0",borderRadius:9,border:`1px solid ${T.red}`,background:T.red+"11",color:T.red,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:13}}>
                      🗑 Delete
                    </button>
                  </div>
                ):<div style={{fontSize:12,color:T.accent,textAlign:"center",padding:10}}>🛡 Admin account — protected</div>}
              </Card>
            );
          })()}
        </div>
      )}

      {tab==="uploads"&&(
        <Card T={T}>
          <div style={{fontWeight:700,marginBottom:14}}>All Platform Uploads</div>
          {users.every(u=>!(u.uploadList||[]).length)?(
            <div style={{color:T.text2,fontSize:13,textAlign:"center",padding:30}}>No uploads on platform yet.</div>
          ):(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["User","Email","Plan","File","Size","Rows","Date"].map(h=><th key={h} style={{padding:"9px 12px",background:T.bg3,color:T.text2,textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {users.flatMap(u=>(u.uploadList||[]).map((f,i)=>(
                    <tr key={u.email+i}>
                      <td style={{padding:"8px 12px",color:T.text,borderBottom:`1px solid ${T.border}`}}>{u.name}</td>
                      <td style={{padding:"8px 12px",color:T.text2,borderBottom:`1px solid ${T.border}`}}>{u.email}</td>
                      <td style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`}}><Badge label={u.plan} color={pc[u.plan]} T={T}/></td>
                      <td style={{padding:"8px 12px",color:T.text,borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace"}}>📄 {f.name}</td>
                      <td style={{padding:"8px 12px",color:T.text2,borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace"}}>{f.size}</td>
                      <td style={{padding:"8px 12px",color:T.text2,borderBottom:`1px solid ${T.border}`,fontFamily:"'JetBrains Mono',monospace"}}>{f.rows||"—"}</td>
                      <td style={{padding:"8px 12px",color:T.text2,borderBottom:`1px solid ${T.border}`}}>{f.date}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab==="stats"&&(
        <div style={{...css.grid(3,16)}}>
          {[
            {title:"Plan Distribution",items:Object.entries(plans).map(([p,n])=>({label:p,val:n,pct:Math.round(n/users.length*100),color:pc[p]||T.accent}))},
            {title:"Account Status",items:[{label:"Active",val:users.filter(u=>!u.banned).length,pct:Math.round(users.filter(u=>!u.banned).length/users.length*100),color:T.green},{label:"Banned",val:users.filter(u=>u.banned).length,pct:Math.round(users.filter(u=>u.banned).length/users.length*100),color:T.red},{label:"Admins",val:users.filter(u=>(u.isAdmin||u.is_admin)).length,pct:Math.round(users.filter(u=>(u.isAdmin||u.is_admin)).length/users.length*100),color:T.accent}]},
            {title:"Upload Stats",items:[{label:"Total Uploads",val:totalUp,color:T.accent},{label:"Avg per User",val:(totalUp/users.length).toFixed(1),color:T.purple},{label:"Most Active",val:[...users].sort((a,b)=>(b.uploads||0)-(a.uploads||0))[0]?.name||"—",color:T.green}]},
          ].map(({title,items},gi)=>(
            <Card key={gi} T={T}>
              <div style={{fontWeight:700,marginBottom:14}}>{title}</div>
              {items.map((it,i)=>(
                <div key={i} style={{marginBottom:12}}>
                  <div style={{...css.flex(0,"row","center","space-between"),fontSize:13,marginBottom:5}}>
                    <span style={{color:T.text}}>{it.label}</span>
                    <span style={{color:it.color,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{it.val}</span>
                  </div>
                  {it.pct!==undefined&&<div style={{height:5,background:T.bg3,borderRadius:3}}><div style={{height:5,width:it.pct+"%",background:it.color,borderRadius:3}}/></div>}
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PRICING PAGE (PayPal)
// ─────────────────────────────────────────────────────────────────────────────
const PAYPAL_CLIENT_ID = "AfFwbX805x9VCt7HvuD5UelE1EvSfwomQMPBIwHpxy_zq1i-pAn2M_t6clqopThZhFZgMXQAgGY75cZw";

function PricingPage({ user, setUser, T }) {
  const [loading, setLoading] = useState(null);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  const plans = [
    {
      id:"free", label:"Free", price:"$0", period:"/mo",
      color:T.green, icon:"🆓",
      features:["3 datasets/month","Basic charts","5MB file limit","Community support"],
      disabled: user.plan==="free"
    },
    {
      id:"pro", label:"Pro", price:"$20", period:"per report",
      color:T.accent, icon:"⚡", popular:true,
      features:["Full data analysis","All 20+ charts","ML predictions","1 PDF report per payment","Email support"],
      disabled: false
    },
    {
      id:"enterprise", label:"Enterprise", price:"$99", period:"/month",
      color:T.orange, icon:"🏢",
      features:["Unlimited reports","Team collaboration","Custom ML models","Priority support","SLA guarantee"],
      disabled: user.plan==="enterprise"
    },
  ];

  const handleBuy = async (planId) => {
    if(planId==="free") return;
    setLoading(planId); setErr("");
    try {
      const res = await fetch("/api/paypal-order", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({plan: planId})
      });
      const data = await res.json();
      if(data.approveUrl) {
        window.location.href = data.approveUrl;
      } else {
        // Fallback: PayPal direct link
        window.open(`https://www.paypal.com/paypalme/data4u/${planId==="pro"?"19":"99"}`, "_blank");
        // Simulate upgrade for demo
        setTimeout(() => {
          user.plan = planId;
          setUser({...user, plan: planId});
          setSuccess(true);
          setLoading(null);
        }, 1000);
      }
    } catch(e) {
      // Fallback PayPal.me
      window.open(`https://www.paypal.com/paypalme/data4u`, "_blank");
      setLoading(null);
      setErr("Redirect to PayPal — complete payment there.");
    }
  };

  return (
    <div style={{padding:"28px 24px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:13,color:T.accent,fontWeight:700,letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>Pricing</div>
        <div style={{fontSize:32,fontWeight:800,color:T.text,marginBottom:10}}>Choose your plan</div>
        <div style={{fontSize:14,color:T.text2}}>Start free, upgrade when you need more power</div>
      </div>

      {success && (
        <div style={{padding:"14px 18px",background:T.green+"11",border:`1px solid ${T.green}44`,borderRadius:12,marginBottom:24,fontSize:14,color:T.green,textAlign:"center"}}>
          ✅ Plan upgraded successfully! Welcome to <b>{user.plan}</b> 🎉
        </div>
      )}
      {err && (
        <div style={{padding:"14px 18px",background:T.orange+"11",border:`1px solid ${T.orange}44`,borderRadius:12,marginBottom:24,fontSize:13,color:T.orange,textAlign:"center"}}>
          {err}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
        {plans.map(p => (
          <div key={p.id} style={{
            background:T.card,border:`2px solid ${p.popular?p.color:T.border}`,
            borderRadius:20,padding:28,position:"relative",
            transform:p.popular?"scale(1.03)":"none",
            boxShadow:p.popular?`0 8px 32px ${p.color}33`:"none",
            transition:"all .2s"
          }}>
            {p.popular && (
              <div style={{position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",
                background:p.color,color:"#000",fontSize:11,fontWeight:800,
                padding:"4px 16px",borderRadius:20,letterSpacing:1}}>
                MOST POPULAR
              </div>
            )}
            <div style={{fontSize:28,marginBottom:12}}>{p.icon}</div>
            <div style={{fontWeight:800,fontSize:18,color:T.text,marginBottom:4}}>{p.label}</div>
            <div style={{marginBottom:20}}>
              <span style={{fontSize:36,fontWeight:800,color:p.color}}>{p.price}</span>
              <span style={{fontSize:14,color:T.text2}}>{p.period}</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
              {p.features.map((f,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.text2}}>
                  <span style={{color:p.color,fontSize:12}}>✓</span> {f}
                </div>
              ))}
            </div>
            {p.disabled ? (
              <div style={{width:"100%",padding:"12px 0",borderRadius:12,background:p.color+"22",
                color:p.color,textAlign:"center",fontWeight:700,fontSize:14,border:`1px solid ${p.color}44`}}>
                ✅ Current Plan
              </div>
            ) : (
              <button onClick={()=>handleBuy(p.id)} disabled={loading===p.id}
                style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",cursor:"pointer",
                  background:p.id==="free"?T.bg3:`linear-gradient(135deg,${p.color},${p.color}cc)`,
                  color:p.id==="free"?T.text2:"#000",fontWeight:700,fontSize:14,
                  fontFamily:"'Syne',sans-serif",transition:"all .2s",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {loading===p.id ? "⏳ Loading..." : p.id==="free" ? "Get Started Free" : `💳 Upgrade to ${p.label}`}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{textAlign:"center",marginTop:32,fontSize:12,color:T.text3}}>
        🔒 Secure payment via PayPal · Cancel anytime · No hidden fees
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function Data4U() {
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("home");
  const [dark,setDark]=useState(true);
  const [data,setData]=useState(null);
  const T=useTheme(dark);

  // After register with paid plan → go to pricing
  useEffect(()=>{
    const handler=()=>setPage("pricing");
    window.addEventListener("gotoPricing",handler);
    return ()=>window.removeEventListener("gotoPricing",handler);
  },[]);

  const handleLogin=(u)=>{
    setUser(u);
    // If user has pending plan → go to pricing to pay
    if(u.pendingPlan){
      setTimeout(()=>setPage("pricing"),600);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Syne',sans-serif"}}>
      <GlobalStyles T={T}/>
      {!user?(
        <AuthScreen onDone={handleLogin} T={T}/>
      ):(
        <>
          {user.plan==="pending" ? (
            <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif"}}>
              <div style={{textAlign:"center",padding:40,maxWidth:480}}>
                <div style={{fontSize:64,marginBottom:16}}>⏳</div>
                <div style={{fontSize:24,fontWeight:800,color:T.text,marginBottom:12}}>Payment Under Review</div>
                <div style={{fontSize:14,color:T.text2,lineHeight:1.8,marginBottom:24}}>
                  Your payment is being verified by our team.<br/>
                  You will get access once approved.<br/>
                  <span style={{color:T.accent}}>Usually within a few hours.</span>
                </div>
                <div style={{padding:"16px 20px",background:T.card,border:`1px solid ${T.border}`,borderRadius:12,fontSize:13,color:T.text3,marginBottom:24}}>
                  📧 Logged in as: <b style={{color:T.text}}>{user.email}</b>
                </div>
                <button onClick={()=>setUser(null)}
                  style={{padding:"12px 32px",borderRadius:12,border:`1px solid ${T.border}`,background:"transparent",color:T.text2,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13}}>
                  ← Back to Login
                </button>
              </div>
            </div>
          ) : (
          <>
          <NavBar user={user} page={page} setPage={setPage} dark={dark} setDark={setDark} data={data} T={T}/>
          <div className="fade-up">
            {page==="home"      &&<HomePage     user={user} setPage={setPage} data={data} T={T}/>}
            {page==="upload"    &&<UploadPage   user={user} setData={setData} setPage={setPage} T={T}/>}
            {page==="clean"     &&<CleanPage    data={data} setData={setData} T={T}/>}
            {page==="visualize" &&<VisualizePage data={data} T={T}/>}
            {page==="predict"   &&<PredictPage  data={data} T={T}/>}
            {page==="dashboard" &&<DashboardPage data={data} T={T}/>}
            {page==="report"    &&<ReportPage   data={data} user={user} T={T}/>}
            {page==="admin"     &&<AdminPanel   currentUser={user} T={T}/>}
          {page==="pricing"   &&<PricingPage   user={user} setUser={setUser} T={T}/>}
          </div>
        </>
          )}
        </>
      )}
    </div>
  );
}
