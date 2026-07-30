import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../api/client";
import Button from "../components/Shared/Button";
import Onboarding from "../components/Shared/Onboarding";
import "./HomePage.css";

const CHANNEL_LABEL: Record<string, string> = { "4-7": "4-7 岁通道", "8-12": "8-12 岁通道" };

export default function HomePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(
    () => sessionStorage.getItem("ai_bole_show_onboarding") === "true"
  );
  function handleOnboardingFinish() { sessionStorage.removeItem("ai_bole_show_onboarding"); setShowOnboarding(false); }
  async function switchChannel(age: "4-7" | "8-12") {
    if (!user || user.age_group === age) return;
    try { await apiFetch(`/auth/me/channel?age_group=${age}`, { method: "PATCH" }); } catch {}
    setUser({ ...user, age_group: age });
  }

  return (
    <main className="home-page">
      {showOnboarding && <Onboarding onFinish={handleOnboardingFinish} />}
      <section className="home-stage">
        <div className="home-copy">
          <span className="home-kicker">今天，从一个小小的想法开始</span>
          <h1 className="home-title">把你的想象<br /><span>变成闪闪发光的故事</span></h1>
          <p className="home-subtitle">
            {user ? `${user.display_name || user.username}，故事世界正在等你续写` : "和故事导演一起创造角色、冒险与只属于你的结局"}
          </p>
          {user?.age_group && (
            <div className="home-channel">
              <span className="home-channel-label">{CHANNEL_LABEL[user.age_group]}</span>
              <button className="home-channel-switch" onClick={() => switchChannel(user.age_group === "4-7" ? "8-12" : "4-7")}>更换通道</button>
            </div>
          )}
          <div className="home-actions">
            <Button variant="primary" size="lg" onClick={() => navigate("/story-create/characters")}>开始创作</Button>
            <Button variant="secondary" size="lg" onClick={() => navigate("/story-create/gallery")}>故事书架</Button>
          </div>
        </div>
        <div className="home-visual" aria-hidden="true">
          <div className="story-portal">
            <span className="portal-star portal-star-one" /><span className="portal-star portal-star-two" />
            <div className="portal-moon" />
            <div className="portal-hill hill-back" /><div className="portal-hill hill-front" />
            <div className="portal-book"><i /><b /></div>
          </div>
          <span className="visual-tag tag-top">想一想</span>
          <span className="visual-tag tag-bottom">说出来</span>
        </div>
      </section>
      <section className="home-features">
        <article className="home-feature feature-pink"><span>01</span><div><h3>创造伙伴</h3><p>捏出故事里的新朋友</p></div></article>
        <article className="home-feature feature-mint"><span>02</span><div><h3>一起续写</h3><p>你一句，我一句</p></div></article>
        <article className="home-feature feature-blue"><span>03</span><div><h3>收藏成长</h3><p>留下每一次奇思妙想</p></div></article>
      </section>
    </main>
  );
}
