import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import {
  colors,
  NAV_HEIGHT,
  CONTAINER_MAX_WIDTH,
  CONTAINER_PADDING_X,
} from "../ui/layout";
import styled from "styled-components";
import defaultUser from "../assets/default_user.jpg";
import logo from "../assets/voca_drink_logo.png";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Styled components moved to module scope to avoid remounting children on each re-render
const AppShell = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: ${colors.text};
  background: ${colors.white};
`;
const NavBar = styled.nav`
  position: relative;
  height: ${NAV_HEIGHT}px;
  border-bottom: 1px solid ${colors.border};
  background: ${colors.surface};
  @media (max-width: 820px) {
    height: 56px;
  }
`;
const NavInner = styled.div`
  height: 100%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  max-width: ${CONTAINER_MAX_WIDTH}px;
  margin: 0 auto;
  padding: 0 ${CONTAINER_PADDING_X}px;
  @media (min-width: 821px) {
    display: flex;
    justify-content: space-between;
  }
`;
const BrandWrap = styled(Link)`
  display: flex;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  @media (max-width: 820px) {
    justify-self: center;
  }
`;
const BrandLogo = styled.img`
  height: 28px;
  width: auto;
`;
const BrandText = styled.span`
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-left: 0px;
  color: ${colors.text};
  @media (max-width: 820px) {
    font-size: 1.1rem;
  }
`;
const NavButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  @media (max-width: 820px) {
    display: none;
  }
`;
const MobileMenuToggle = styled.button`
  display: none;
  @media (max-width: 820px) {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    background: transparent;
    border: none;
    padding: 6px;
    margin: 0;
    line-height: 0;
    color: ${colors.text};
    cursor: pointer;
  }
`;
const MobileMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  border-top: 1px solid ${colors.border};
  background: #ffffff;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.05);
  padding: 6px ${CONTAINER_PADDING_X}px 8px;
  z-index: 20;
  @media (min-width: 821px) {
    display: none;
  }
`;
const MobileMenuList = styled.ul`
  list-style: none;
  padding: 4px 0;
  margin: 0;
`;
const MobileMenuItemLink = styled(Link)`
  display: block;
  padding: 12px 14px;
  border-bottom: 1px solid ${colors.border};
  color: ${colors.text};
  text-decoration: none;
  font-size: 15px;
`;
const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  justify-self: end;
`;
const NavButtonLink = styled(Link)`
  border: 1px solid ${colors.border};
  padding: 8px 14px;
  border-radius: 8px;
  background: ${colors.white};
  cursor: pointer;
  font-size: 14px;
  text-decoration: none;
  color: ${colors.text};
`;
const SignInLink = styled(Link)`
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  background: #0f172a;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
`;
const LoadingBadge = styled.div`
  border: 1px solid ${colors.border};
  padding: 8px 14px;
  border-radius: 8px;
  background: ${colors.white};
  font-size: 14px;
`;
const AvatarWrap = styled.div`
  position: relative;
`;
const AvatarButton = styled.button`
  border: 1px solid ${colors.border};
  border-radius: 999px;
  padding: 0;
  width: 36px;
  height: 36px;
  background: #fff;
  overflow: hidden;
  cursor: pointer;
  @media (max-width: 820px) {
    width: 32px;
    height: 32px;
  }
`;
const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
const DropdownMenu = styled.div`
  position: absolute;
  top: 44px;
  right: 0;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  min-width: 160px;
  z-index: 10;
`;
const DropdownItemLink = styled(Link)`
  display: block;
  padding: 10px 12px;
  text-decoration: none;
  color: ${colors.text};
  font-size: 14px;
`;
const DropdownSignOut = styled.button`
  display: block;
  padding: 10px 12px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #ef4444;
  font-weight: 600;
  font-size: 14px;
`;
const Main = styled.main`
  max-width: ${CONTAINER_MAX_WIDTH}px;
  margin: 0 auto;
  padding: 24px ${CONTAINER_PADDING_X}px;
  width: 100%;
  min-height: calc(100vh - ${NAV_HEIGHT}px);
  @media (max-width: 640px) {
    padding: 20px ${CONTAINER_PADDING_X}px;
  }
`;
const FooterWrap = styled.footer`
  border-top: 1px solid ${colors.border};
  padding: 20px 0;
  color: ${colors.muted};
  font-size: 14px;
`;
const FooterInner = styled.div`
  max-width: ${CONTAINER_MAX_WIDTH}px;
  margin: 0 auto;
  padding: 0 ${CONTAINER_PADDING_X}px;
  width: 100%;
`;

export function RootLayout() {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const avatarBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!user) {
      setPhotoURL(null);
      return;
    }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() as any;
      setPhotoURL((d?.photoURL as string) ?? user.photoURL ?? null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    function onClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      // Ignore clicks on the hamburger toggle button itself
      if (toggleRef.current && toggleRef.current.contains(target)) {
        return;
      }
      // Ignore clicks on the avatar button itself
      if (avatarBtnRef.current && avatarBtnRef.current.contains(target)) {
        return;
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("pointerdown", onClickOutside);
    return () => {
      window.removeEventListener("pointerdown", onClickOutside);
    };
  }, []);

  // onLogin removed; logged-out users navigate to /login

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  // Full-bleed pages (e.g., /login) render without the app chrome
  if (location.pathname === "/login") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <NavBar>
        <NavInner>
          <MobileMenuToggle
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMobileMenuOpen((v) => !v);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label="Toggle menu"
            ref={toggleRef as any}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              width="24"
              height="24"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </MobileMenuToggle>
          <BrandWrap to="/" aria-label="Voca Drink">
            <BrandLogo src={logo} alt="Voca Drink Logo" />
            <BrandText>VocaDrink.</BrandText>
          </BrandWrap>
          <RightGroup>
            <NavButtons>
              <NavButtonLink
                to="/decks"
                aria-current={
                  location.pathname === "/decks" ? "page" : undefined
                }
              >
                {t("nav.decks")}
              </NavButtonLink>
              <NavButtonLink
                to="/vocab?deck=japanese"
                aria-current={
                  location.pathname.startsWith("/vocab") ? "page" : undefined
                }
              >
                {t("nav.vocab")}
              </NavButtonLink>
              <NavButtonLink
                to="/learn"
                aria-current={
                  location.pathname === "/learn" ? "page" : undefined
                }
              >
                {t("nav.learn")}
              </NavButtonLink>
              <NavButtonLink
                to="/review"
                aria-current={
                  location.pathname === "/review" ? "page" : undefined
                }
              >
                {t("nav.review")}
              </NavButtonLink>
            </NavButtons>
            {isLoading ? (
              <LoadingBadge aria-busy>{t("nav.loading")}</LoadingBadge>
            ) : user ? (
              <AvatarWrap ref={userMenuRef}>
                <AvatarButton
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-haspopup
                  aria-expanded={userMenuOpen}
                  ref={avatarBtnRef as any}
                >
                  <AvatarImg
                    src={photoURL || user?.photoURL || defaultUser}
                    alt="avatar"
                  />
                </AvatarButton>
                {userMenuOpen && (
                  <DropdownMenu role="menu">
                    <DropdownItemLink
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      {t("nav.profile")}
                    </DropdownItemLink>
                    <DropdownSignOut onClick={onLogout}>
                      {t("nav.signOut")}
                    </DropdownSignOut>
                  </DropdownMenu>
                )}
              </AvatarWrap>
            ) : (
              <SignInLink to="/login">{t("nav.signInShort")}</SignInLink>
            )}
          </RightGroup>
        </NavInner>
        {mobileMenuOpen && (
          <MobileMenu
            ref={mobileMenuRef as any}
            onClick={(e) => {
              // Click anywhere within the menu should not propagate to outside
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              // If user taps the toggle again while menu is open, close immediately
              const target = e.target as Node;
              if (toggleRef.current && toggleRef.current.contains(target)) {
                setMobileMenuOpen(false);
              }
            }}
          >
            <MobileMenuList>
              <li>
                <MobileMenuItemLink
                  to="/decks"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("nav.decks")}
                </MobileMenuItemLink>
              </li>
              <li>
                <MobileMenuItemLink
                  to="/vocab?deck=japanese"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("nav.vocab")}
                </MobileMenuItemLink>
              </li>
              <li>
                <MobileMenuItemLink
                  to="/learn"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("nav.learn")}
                </MobileMenuItemLink>
              </li>
              <li>
                <MobileMenuItemLink
                  to="/review"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("nav.review")}
                </MobileMenuItemLink>
              </li>
              {/* No auth controls here; use avatar menu */}
            </MobileMenuList>
          </MobileMenu>
        )}
      </NavBar>
      <Main>
        {useMemo(
          () => (
            <Outlet />
          ),
          [location.pathname, location.search]
        )}
      </Main>
      <FooterWrap>
        <FooterInner>© {new Date().getFullYear()} Voca Drink</FooterInner>
      </FooterWrap>
    </AppShell>
  );
}
