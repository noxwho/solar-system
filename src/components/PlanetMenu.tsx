import { X, ArrowUpRight } from "lucide-react";
import { planets } from "../data/planets";
export default function PlanetMenu({
  index,
  onSelect,
  onClose,
}: {
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="menu-backdrop" onClick={onClose}>
      <section
        className="planet-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Выберите мир"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-heading">
          <span className="eyebrow">ВЫБЕРИТЕ НАПРАВЛЕНИЕ</span>
          <button
            autoFocus
            className="icon-button"
            aria-label="Закрыть меню"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2>
          Девять остановок.
          <br />
          <em>Бесконечность открытий.</em>
        </h2>
        <div className="menu-list">
          {planets.map((p, i) => (
            <button
              className={index === i ? "selected" : ""}
              key={p.id}
              onClick={() => onSelect(i)}
            >
              <span className="menu-number">0{i}</span>
              <img src={p.texture} alt="" />
              <span>
                {p.name}
                <small>{p.english}</small>
              </span>
              <ArrowUpRight size={19} />
            </button>
          ))}
        </div>
        <p className="menu-note">
          Каждое путешествие начинается с любопытства.
        </p>
      </section>
    </div>
  );
}
