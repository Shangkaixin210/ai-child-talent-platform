/**
 * Auth module — login/register, token management, authenticated fetch wrapper.
 */
window.Auth = (function(){
  var TOKEN_KEY = 'career-auth-token-v1';
  var SSO_SESSION_KEY = 'career-sso-session-v1';
  var _user = null;

  function platformLoginUrl(){
    return window.location.protocol + '//' + window.location.hostname + ':5173/platform-login';
  }

  function removeSsoTokenFromUrl(){
    var url = new URL(window.location.href);
    url.searchParams.delete('sso_token');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  }

  function showPlatformEntryGuide(){
    if (document.getElementById('sso-entry-guide')) return;
    var overlay = document.createElement('div');
    overlay.id = 'sso-entry-guide';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div style="max-width:520px;padding:42px 30px;border-radius:28px;background:#fffdf8;box-shadow:0 24px 70px rgba(86,58,40,.20);text-align:center;color:#5e493a">'+
        '<div style="font-size:54px;line-height:1">🗺️</div>'+
        '<h1 style="margin:18px 0 10px;color:#b86b45;font-size:28px">从星芽成长进入吧</h1>'+
        '<p style="margin:0;line-height:1.8;font-size:16px">职业体验使用总平台的统一登录。这样你的探索足迹和成长报告才能被安全地保存到同一个成长档案中。</p>'+
        '<button id="sso-entry-btn" type="button" style="margin-top:24px;border:0;border-radius:999px;padding:14px 24px;background:#e9854d;color:white;font-size:16px;font-weight:700;cursor:pointer">前往总平台登录</button>'+
      '</div>';
    Object.assign(overlay.style, {position:'fixed', inset:'0', zIndex:'99999', display:'grid', placeItems:'center', padding:'20px', background:'rgba(61,45,35,.48)'});
    document.body.appendChild(overlay);
    document.getElementById('sso-entry-btn').onclick = function(){
      try { window.top.location.href = platformLoginUrl(); }
      catch (_) { window.location.href = platformLoginUrl(); }
    };
  }

  function getToken(){
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(t){
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function isLoggedIn(){
    return !!getToken();
  }

  function getUser(){
    return _user;
  }

  function fetchWithAuth(url, options){
    options = options || {};
    var token = getToken();
    options.headers = options.headers || {};
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    return fetch(url, options);
  }

  function checkAuth(){
    var token = getToken();
    var isSsoSession = localStorage.getItem(SSO_SESSION_KEY) === '1';
    if (!token || !isSsoSession) {
      var ssoToken = new URLSearchParams(window.location.search).get('sso_token');
      if (ssoToken) return ssoLogin(ssoToken);
      _user = null;
      setToken('');
      updateNavUI();
      showPlatformEntryGuide();
      return Promise.resolve(null);
    }
    return fetch('/api/auth/me', {
      headers: {'Authorization': 'Bearer ' + token}
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (d && d.authenticated) {
          _user = d.user;
          updateNavUI();
          return _user;
        }
        _user = null;
        updateNavUI();
        return null;
      }).catch(function(){
        _user = null;
        setToken('');
        localStorage.removeItem(SSO_SESSION_KEY);
        showPlatformEntryGuide();
        return null;
      });
  }

  function ssoLogin(ssoToken){
    return fetch('/api/auth/sso-login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sso_token: ssoToken})
    }).then(function(r){
      return r.json().then(function(d){
        if (!r.ok) throw new Error(d.detail || '统一登录已过期，请重新登录');
        return d;
      });
    }).then(function(d){
      setToken(d.token);
      localStorage.setItem(SSO_SESSION_KEY, '1');
      _user = d.user;
      removeSsoTokenFromUrl();
      updateNavUI();
      if (window.onAuthChanged) window.onAuthChanged(d.user);
      return d.user;
    }).catch(function(){
      _user = null;
      setToken('');
      localStorage.removeItem(SSO_SESSION_KEY);
      showPlatformEntryGuide();
      return null;
    });
  }

  function login(username, password){
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: username, password: password})
    }).then(function(r){
      return r.json().then(function(d){ if (!r.ok) throw new Error(d.detail || d.error || '登录失败'); return d; });
    }).then(function(d){
      setToken(d.token);
      _user = d.user;
      updateNavUI();
      return d;
    });
  }

  function register(username, password, displayName, age){
    return fetch('/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: username, password: password, display_name: displayName, age: age})
    }).then(function(r){
      return r.json().then(function(d){ if (!r.ok) throw new Error(d.detail || d.error || '注册失败'); return d; });
    }).then(function(d){
      setToken(d.token);
      _user = d.user;
      updateNavUI();
      return d;
    });
  }

  function logout(){
    var token = getToken();
    return fetch('/api/auth/logout', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + token}
    }).then(function(){
      setToken('');
      localStorage.removeItem(SSO_SESSION_KEY);
      _user = null;
      updateNavUI();
    }).catch(function(){
      setToken('');
      localStorage.removeItem(SSO_SESSION_KEY);
      _user = null;
      updateNavUI();
    });
  }

  function showLoginModal(tab){
    // Remove existing modal
    var existing = document.getElementById('auth-modal-overlay');
    if (existing) existing.remove();

    tab = tab || 'login';
    var overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.className = 'auth-modal-overlay';
    overlay.innerHTML =
      '<div class="auth-modal-card">'+
        '<button type="button" class="auth-modal-close" onclick="this.closest(\'.auth-modal-overlay\').remove()">✕</button>'+
        '<div class="auth-mascot"><img src="/static/images/mascots/explorer-guide.png" alt=""></div>'+
        '<div class="auth-tabs">'+
          '<button type="button" class="auth-tab '+(tab==='login'?'active':'')+'" id="auth-tab-login">登录</button>'+
          '<button type="button" class="auth-tab '+(tab==='register'?'active':'')+'" id="auth-tab-register">注册</button>'+
        '</div>'+
        // Login form
        '<form id="auth-form-login" class="auth-form" style="'+(tab==='login'?'':'display:none')+'">'+
          '<div class="auth-field"><label>用户名</label><input type="text" id="auth-login-username" placeholder="输入你的用户名" autocomplete="username" required></div>'+
          '<div class="auth-field"><label>密码</label><input type="password" id="auth-login-password" placeholder="输入密码" autocomplete="current-password" required></div>'+
          '<div id="auth-login-error" class="auth-error" style="display:none"></div>'+
          '<button type="submit" class="auth-submit-btn">登 录</button>'+
        '</form>'+
        // Register form
        '<form id="auth-form-register" class="auth-form" style="'+(tab==='register'?'':'display:none')+'">'+
          '<div class="auth-field"><label>用户名</label><input type="text" id="auth-reg-username" placeholder="取一个用户名（3-20字）" autocomplete="username" required></div>'+
          '<div class="auth-field"><label>密码</label><input type="password" id="auth-reg-password" placeholder="至少4个字符" autocomplete="new-password" required></div>'+
          '<div class="auth-field"><label>你的名字（或昵称）</label><input type="text" id="auth-reg-name" placeholder="让大家怎么称呼你？" required></div>'+
          '<div class="auth-field"><label>年龄</label><select id="auth-reg-age" required>'+
            '<option value="">选择年龄</option>'+
            Array.from({length:9}, function(_,i){ return '<option value="'+(i+6)+'">'+(i+6)+'岁</option>'; }).join('')+
          '</select></div>'+
          '<div id="auth-reg-error" class="auth-error" style="display:none"></div>'+
          '<button type="submit" class="auth-submit-btn">注 册</button>'+
        '</form>'+
        '<p class="auth-note">🔒 密码已加密存储。你的探索数据将安全地保存在你的账号下。</p>'+
      '</div>';

    document.body.appendChild(overlay);

    // Tab switching
    overlay.querySelector('#auth-tab-login').onclick = function(){
      this.classList.add('active');
      overlay.querySelector('#auth-tab-register').classList.remove('active');
      overlay.querySelector('#auth-form-login').style.display = '';
      overlay.querySelector('#auth-form-register').style.display = 'none';
    };
    overlay.querySelector('#auth-tab-register').onclick = function(){
      this.classList.add('active');
      overlay.querySelector('#auth-tab-login').classList.remove('active');
      overlay.querySelector('#auth-form-login').style.display = 'none';
      overlay.querySelector('#auth-form-register').style.display = '';
    };

    // Login submit
    overlay.querySelector('#auth-form-login').onsubmit = function(e){
      e.preventDefault();
      var err = overlay.querySelector('#auth-login-error');
      err.style.display = 'none';
      var btn = this.querySelector('.auth-submit-btn');
      btn.disabled = true; btn.textContent = '登录中…';
      login(
        overlay.querySelector('#auth-login-username').value,
        overlay.querySelector('#auth-login-password').value
      ).then(function(d){
        overlay.remove();
        if (d.claimed_sessions > 0) {
          alert('已关联 ' + d.claimed_sessions + ' 条之前的体验记录！');
        }
        if (window.onAuthChanged) window.onAuthChanged(d.user);
      }).catch(function(e){
        err.textContent = e.message || '登录失败，请重试';
        err.style.display = 'block';
      }).finally(function(){
        btn.disabled = false; btn.textContent = '登 录';
      });
    };

    // Register submit
    overlay.querySelector('#auth-form-register').onsubmit = function(e){
      e.preventDefault();
      var err = overlay.querySelector('#auth-reg-error');
      err.style.display = 'none';
      var btn = this.querySelector('.auth-submit-btn');
      btn.disabled = true; btn.textContent = '注册中…';
      register(
        overlay.querySelector('#auth-reg-username').value,
        overlay.querySelector('#auth-reg-password').value,
        overlay.querySelector('#auth-reg-name').value,
        parseInt(overlay.querySelector('#auth-reg-age').value) || 10
      ).then(function(d){
        overlay.remove();
        if (d.claimed_sessions > 0) {
          alert('已关联 ' + d.claimed_sessions + ' 条之前的体验记录到你的账号！');
        }
        if (window.onAuthChanged) window.onAuthChanged(d.user);
      }).catch(function(e){
        err.textContent = e.message || '注册失败，请重试';
        err.style.display = 'block';
      }).finally(function(){
        btn.disabled = false; btn.textContent = '注 册';
      });
    };

    // Close on backdrop click
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
  }

  function updateNavUI(){
    var btn = document.getElementById('auth-nav-btn');
    if (!btn) return;
    if (_user) {
      btn.innerHTML = '<span class="auth-nav-avatar">🧑</span><span>你好，'+escHtml(_user.display_name)+'</span>';
      btn.title = '点击退出登录';
      btn.className = 'auth-nav-btn logged-in';
      btn.onclick = function(){
        if (confirm('确定要退出登录吗？你的数据不会丢失，下次登录还在。')) {
          logout().then(function(){ if (window.onAuthChanged) window.onAuthChanged(null); });
        }
      };
    } else {
      btn.innerHTML = '<span>登录 / 注册</span>';
      btn.title = '登录以保存你的体验记录';
      btn.className = 'auth-nav-btn';
      btn.onclick = function(){ showLoginModal('login'); };
    }
  }

  function initNavButton(){
    // 本模块不再创建独立登录/注册按钮；身份由总平台统一提供。
  }

  function escHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function(){
    initNavButton();
    checkAuth();
  });

  return {
    getToken: getToken,
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    fetch: fetchWithAuth,
    checkAuth: checkAuth,
    ssoLogin: ssoLogin,
    login: login,
    register: register,
    logout: logout,
    showLoginModal: showLoginModal,
    updateNavUI: updateNavUI,
  };
})();
