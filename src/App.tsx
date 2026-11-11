import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, Grid2X2, Menu, Orbit, X } from "lucide-react";
import SolarScene from "./scenes/SolarScene";
import PlanetMenu from "./components/PlanetMenu";
import { createCinematicRuntime } from "./animations/cinematicRuntime";
import {
  moveNavigation,
  pushStage,
  systemStage,
  nextStage,
  type Navigation,
  type Stage,
} from "./animations/navigation";
import type { CameraCommand } from "./animations/cinematicTypes";
import { planets } from "./data/planets";
import { stories } from "./data/stories";
import { cameraViews } from "./animations/cameraViews";
import { useReducedMotion } from "./hooks/useReducedMotion";
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="webgl-error">
        <h2>Связь с космосом прервалась</h2>
        <p>Проверьте поддержку WebGL и доступность локальных текстур.</p>
        <button className="outlined-button" onClick={() => location.reload()}>
          Повторить загрузку
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [ready, setReady] = useState(false),
    [introDone, setIntroDone] = useState(false),
    [moving, setMoving] = useState(false),
    [menu, setMenu] = useState(false),
    [help, setHelp] = useState(false);
  const [shown, setShown] = useState<Stage>(systemStage),
    [nav, setNav] = useState<Navigation>({ entries: [systemStage], cursor: 0 }),
    [command, setCommand] = useState<CameraCommand | null>(null);
  const navRef = useRef(nav),
    introReady = useRef(false),
    serial = useRef(0),
    runtime = useRef(createCinematicRuntime()).current;
  const infoRef = useRef<HTMLElement>(null),
    overviewRef = useRef<HTMLElement>(null),
    reduced = useReducedMotion();
  const onReady = useCallback(() => setReady(true), []),
    onArrive = useCallback((s: Stage) => setShown(s), []),
    onMoving = useCallback((v: boolean) => setMoving(v), []),
    onIntro = useCallback(() => {
      introReady.current = true;
      setIntroDone(true);
    }, []);
  const commit = useCallback((next: Navigation) => {
    if (next === navRef.current) return;
    navRef.current = next;
    setNav(next);
    setCommand({ id: ++serial.current, stage: next.entries[next.cursor] });
    setMenu(false);
  }, []);
  const select = useCallback(
    (index: number) => {
      if (introReady.current)
        commit(
          pushStage(navRef.current, { kind: "planet", index, level: "full" }),
        );
    },
    [commit],
  );
  const step = useCallback(
    (direction: -1 | 1) => {
      if (introDone) commit(moveNavigation(navRef.current, direction));
    },
    [introDone, commit],
  );
  const overview = useCallback(() => {
    if (introDone) commit(pushStage(navRef.current, systemStage));
  }, [introDone, commit]);
  const target = nav.entries[nav.cursor],
    canBack = introDone && nav.cursor > 0,
    canNext =
      introDone &&
      (nav.cursor < nav.entries.length - 1 || nextStage(target) !== null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.altKey ||
        e.metaKey ||
        e.ctrlKey ||
        (e.target as HTMLElement).closest("input,textarea,select")
      )
        return;
      if (e.key === "Escape") {
        if (menu || help) {
          setMenu(false);
          setHelp(false);
        } else overview();
      }
      if (
        !menu &&
        !help &&
        !e.repeat &&
        (e.key === "ArrowRight" || e.key === "ArrowLeft")
      ) {
        e.preventDefault();
        step(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [step, overview, menu, help]);
  useEffect(() => {
    if (!menu && !help) return;
    const old = document.activeElement as HTMLElement;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = document
        .querySelector('[role="dialog"]')
        ?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
          "button,a[href]",
        );
      if (!list?.length) return;
      const first = list[0],
        last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      old?.focus();
    };
  }, [menu, help]);
  const planet = shown.kind === "planet" ? planets[shown.index] : null,
    story = shown.kind === "planet" ? stories[shown.index] : null;
  const close = shown.kind === "planet" && shown.level === "close";
  const current = target.kind === "planet" ? planets[target.index] : null;
  return (
    <main
      className={`camera-experience ${shown.kind === "system" ? "view-system" : close ? "view-close" : "view-full"} ${moving ? "is-traveling" : ""}`}
      data-view={target.kind === "system" ? "system" : target.level}
      data-index={target.kind === "planet" ? target.index : -1}
      data-moving={moving}
      data-intro={introDone}
    >
      <div className="scene">
        <SceneBoundary>
          <SolarScene
            controller={{
              runtime,
              ready,
              reduced,
              command,
              infoRef,
              overviewRef,
              onMoving,
              onArrive,
              onIntro,
            }}
            onReady={onReady}
            interactive={introDone && shown.kind === "system" && !moving}
            onSelect={select}
          />
        </SceneBoundary>
      </div>
      <div className="vignette" />
      <header className="topbar">
        <button
          className="brand"
          aria-label="К Солнечной системе"
          disabled={!introDone}
          onClick={overview}
        >
          <Orbit size={24} strokeWidth={1.15} />
          <span>
            PLANET<small>THE SOLAR SYSTEM, UP CLOSE</small>
          </span>
        </button>
        <div className="header-right">
          <span className="edition">
            A DIFFERENT PERSPECTIVE ON EVERYTHING.
          </span>
          <button
            className="menu-button"
            aria-label="Открыть меню планет"
            disabled={!introDone}
            onClick={() => setMenu(true)}
          >
            МИРЫ <Menu size={18} />
          </button>
        </div>
      </header>
      <section className="overview-copy" ref={overviewRef}>
        <div className="eyebrow">
          <span className="live-dot" /> НАШ КОСМИЧЕСКИЙ АДРЕС
        </div>
        <h1>
          OUR SOLAR
          <br />
          <span>SYSTEM</span>
        </h1>
        <p>
          Восемь миров.
          <br />
          <em>Бесконечность открытий.</em>
        </p>
        <div className="overview-instruction">
          <span className="tiny-rule" /> ВЫБЕРИТЕ ПЛАНЕТУ ИЛИ НАЖМИТЕ →
        </div>
      </section>
      <article
        className="planet-copy"
        data-side={
          close && shown.kind === "planet"
            ? cameraViews[shown.index].close.copy
            : "right"
        }
        ref={infoRef}
        aria-hidden={shown.kind === "system"}
        aria-live="polite"
      >
        <div className="eyebrow" data-reveal>
          <span className="live-dot" />
          {planet?.kind}
          <span className="info-coordinate">
            {shown.kind === "planet" ? `0${shown.index}` : ""} / 08
          </span>
        </div>
        <div className="planet-heading" data-reveal>
          <span>{planet?.english.toUpperCase()}</span>
          <h1>{planet?.name}</h1>
        </div>
        <div className="planet-narrative" data-reveal>
          {close ? (
            <>
              <h2>{story?.closeTitle}</h2>
              <p>{story?.closeText}</p>
            </>
          ) : (
            <>
              <p className="atmospheric">{planet?.description}</p>
              <p className="science-description">{story?.overview}</p>
            </>
          )}
        </div>
        <div className="planet-details" data-reveal>
          {close ? (
            <div className="extra-feature">
              <span>ЕЩЁ ОДНА ДЕТАЛЬ</span>
              <p>{story?.feature}</p>
            </div>
          ) : (
            <dl className="planet-stats">
              <div>
                <dt>ДИАМЕТР</dt>
                <dd>{planet?.diameter}</dd>
              </div>
              <div>
                <dt>ОТ СОЛНЦА</dt>
                <dd>{planet?.distance}</dd>
              </div>
              <div>
                <dt>ПРОДОЛЖИТЕЛЬНОСТЬ ГОДА</dt>
                <dd>
                  {planet?.year === "—" ? "Не применяется" : planet?.year}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </article>
      <button
        className="side-arrow previous"
        aria-label="Предыдущий этап"
        disabled={!canBack}
        onClick={() => step(-1)}
      >
        <ArrowLeft size={21} strokeWidth={1.4} />
        <span>НАЗАД</span>
      </button>
      <button
        className="side-arrow next"
        aria-label="Следующий этап"
        disabled={!canNext}
        onClick={() => step(1)}
      >
        <ArrowRight size={21} strokeWidth={1.4} />
        <span>ДАЛЬШЕ</span>
      </button>
      <footer className="journey-footer">
        <div className="current-world">
          <span className="live-dot" />
          <span>
            {!introDone
              ? "РАСКРЫВАЕМ СОЛНЕЧНУЮ СИСТЕМУ"
              : moving
                ? "КАМЕРА В ПУТИ"
                : target.kind === "system"
                  ? "ВЫБЕРИТЕ СВОЙ МИР"
                  : "ВЫ НА ОРБИТЕ"}
            <strong>{current?.name ?? "Солнечная система"}</strong>
          </span>
        </div>
        <div className="stage-indicator" aria-label="Уровень просмотра">
          <span className={target.kind === "system" ? "active" : ""}>
            ОБЗОР
          </span>
          <i />
          <span
            className={
              target.kind === "planet" && target.level === "full"
                ? "active"
                : ""
            }
          >
            01 <small>ПЛАНЕТА</small>
          </span>
          <i />
          <span
            className={
              target.kind === "planet" && target.level === "close"
                ? "active"
                : ""
            }
          >
            02 <small>КРУПНЫЙ ПЛАН</small>
          </span>
        </div>
        <div className="footer-actions">
          <button
            className="icon-button"
            aria-label="Источники и управление"
            onClick={() => setHelp(true)}
          >
            ?
          </button>
          <button
            className="icon-button"
            aria-label="Общий вид системы"
            disabled={!introDone}
            onClick={overview}
          >
            <Grid2X2 size={16} />
          </button>
        </div>
        <div className="journey-progress">
          <i
            style={{
              transform: `scaleX(${target.kind === "system" ? 0 : (target.index * 2 + (target.level === "close" ? 2 : 1)) / 18})`,
            }}
          />
        </div>
      </footer>
      <div className="scale-note">
        <span>МАСШТАБЫ И СКОРОСТИ АДАПТИРОВАНЫ</span>
        <span>ONE STAR. EIGHT WORLDS. YOUR JOURNEY.</span>
      </div>
      {menu && (
        <PlanetMenu
          index={target.kind === "planet" ? target.index : 0}
          onSelect={select}
          onClose={() => setMenu(false)}
        />
      )}
      {help && (
        <div className="help-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-panel"
            role="dialog"
            aria-modal="true"
            aria-label="О путешествии"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button help-close"
              aria-label="Закрыть справку"
              onClick={() => setHelp(false)}
            >
              <X size={19} />
            </button>
            <Orbit size={31} strokeWidth={1} />
            <div className="eyebrow">ПОСМОТРИТЕ НЕМНОГО БЛИЖЕ</div>
            <h2>
              Ваша точка зрения.
              <br />
              <em>Ваше путешествие.</em>
            </h2>
            <p>
              Выберите 3D-планету или мир в меню. Стрелка → показывает крупный
              план, затем ведёт к следующему объекту. Стрелка ← возвращает по
              вашей истории.
            </p>
            <p>
              Работают клавиши ← →. Быстрое повторное нажатие меняет цель
              перелёта из текущего положения. Кнопка карты возвращает общий вид,
              Escape закрывает окно или возвращает к системе.
            </p>
            <div className="credits">
              <p>
                Данные:{" "}
                <a
                  href={
                    story?.source ??
                    "https://science.nasa.gov/solar-system/planets/"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  NASA Science
                </a>
                ,{" "}
                <a
                  href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
                  target="_blank"
                  rel="noreferrer"
                >
                  NSSDCA
                </a>
                . Диаметры экваториальные, величины округлены. Солнечный год на
                панели не указан: Солнце — звезда.
              </p>
              <p>
                Текстуры:{" "}
                <a
                  href="https://www.solarsystemscope.com/textures/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Solar System Scope / INOVE
                </a>
                ,{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                , по данным NASA. Desktop — до 4K, мобильные — 2K. Цвета карт
                обработаны авторами; масштаб и освещение адаптированы.
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
