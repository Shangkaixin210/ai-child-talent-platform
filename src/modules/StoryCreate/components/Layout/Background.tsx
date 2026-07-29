import './Background.css';
export default function Background() {
  return (
    <div className="bg-deco" aria-hidden="true">
      <i className="bg-orb bg-orb-1" /><i className="bg-orb bg-orb-2" /><i className="bg-orb bg-orb-3" />
      <span className="bg-float bg-float-1">+</span>
      <span className="bg-float bg-float-2">*</span>
      <span className="bg-float bg-float-3">+</span>
      <span className="bg-float bg-float-4">*</span>
    </div>
  );
}
