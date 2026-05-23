import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegistering = mode === 'register';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegistering) {
        await signUp(email, password, fullName);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message || (isRegistering ? 'Profile creation failed.' : 'Login failed. Check your credentials.'));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'24px' }}>
      <div style={{ background:'var(--s1)', border:'1px solid var(--b1)', borderRadius:'12px', padding:'34px', width:'390px', maxWidth:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:'26px' }}>
          <div style={{ fontFamily:'var(--syne)', fontWeight:800, fontSize:'22px', letterSpacing:'3px', color:'var(--accent)' }}>
            RORO <span style={{ color:'var(--t2)' }}>FLEET</span>
          </div>
          <div style={{ fontSize:'10px', color:'var(--t3)', marginTop:'6px', letterSpacing:'1px' }}>
            VESSEL PERFORMANCE PLATFORM
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'22px' }}>
          <button type="button" onClick={() => switchMode('signin')} style={{
            padding:'10px 8px', border:'1px solid var(--b1)', borderRadius:'6px',
            background: !isRegistering ? 'var(--accent)' : 'var(--s2)',
            color: !isRegistering ? '#000' : 'var(--t2)',
            fontFamily:'var(--syne)', fontWeight:700, fontSize:'11px', letterSpacing:'1px',
            cursor:'pointer',
          }}>
            SIGN IN
          </button>
          <button type="button" onClick={() => switchMode('register')} style={{
            padding:'10px 8px', border:'1px solid var(--b1)', borderRadius:'6px',
            background: isRegistering ? 'var(--accent)' : 'var(--s2)',
            color: isRegistering ? '#000' : 'var(--t2)',
            fontFamily:'var(--syne)', fontWeight:700, fontSize:'11px', letterSpacing:'1px',
            cursor:'pointer',
          }}>
            CREATE PROFILE
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <div style={{ marginBottom:'14px' }}>
              <div style={{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'6px' }}>FULL NAME</div>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your name" required style={{ width:'100%', padding:'10px 12px', fontSize:'12px' }} />
            </div>
          )}

          <div style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'6px' }}>EMAIL ADDRESS</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required style={{ width:'100%', padding:'10px 12px', fontSize:'12px' }} />
          </div>

          <div style={{ marginBottom:'20px' }}>
            <div style={{ fontSize:'9px', color:'var(--t3)', letterSpacing:'1.5px', marginBottom:'6px' }}>PASSWORD</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required minLength={isRegistering ? 8 : undefined} style={{ width:'100%', padding:'10px 12px', fontSize:'12px' }} />
          </div>

          {error && (
            <div style={{ background:'rgba(255,69,96,.1)', border:'1px solid rgba(255,69,96,.3)', borderRadius:'6px', padding:'10px 12px', marginBottom:'16px', fontSize:'11px', color:'var(--red)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'12px',
            background: loading ? 'var(--b2)' : 'var(--accent)',
            border:'none', borderRadius:'6px',
            fontFamily:'var(--syne)', fontWeight:700, fontSize:'12px',
            letterSpacing:'1px', color: loading ? 'var(--t2)' : '#000',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? (isRegistering ? 'CREATING PROFILE...' : 'SIGNING IN...') : (isRegistering ? 'CREATE MY PROFILE' : 'SIGN IN')}
          </button>
        </form>

        <div style={{ marginTop:'22px', padding:'12px', background:'var(--s2)', borderRadius:'6px', fontSize:'10px', color:'var(--t3)', lineHeight:'1.6', textAlign:'center' }}>
          New profiles are created in PostgreSQL with viewer access.
        </div>
      </div>
    </div>
  );
}
