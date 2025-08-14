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
import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function RootLayout() {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
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

  const AppShell = styled.div`
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    color: ${colors.text};
    background: ${colors.white};
  `;
  const NavBar = styled.nav`
    height: ${NAV_HEIGHT}px;
    border-bottom: 1px solid ${colors.border};
    background: ${colors.surface};
  `;
  const NavInner = styled.div`
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: ${CONTAINER_MAX_WIDTH}px;
    margin: 0 auto;
    padding: 0 ${CONTAINER_PADDING_X}px;
  `;
  const BrandWrap = styled(Link)`
    display: flex;
    align-items: center;
    gap: 2px;
    text-decoration: none;
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
  `;
  const NavButtons = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
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

  return (
    <AppShell>
      <NavBar>
        <NavInner>
          <BrandWrap to="/" aria-label="Voca Drink">
            <BrandLogo src={logo} alt="Voca Drink Logo" />
            <BrandText>VocaDrink.</BrandText>
          </BrandWrap>
          <NavButtons>
            <NavButtonLink
              to="/decks"
              aria-current={location.pathname === "/decks" ? "page" : undefined}
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
              aria-current={location.pathname === "/learn" ? "page" : undefined}
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
            {isLoading ? (
              <LoadingBadge aria-busy>{t("nav.loading")}</LoadingBadge>
            ) : user ? (
              <AvatarWrap ref={menuRef}>
                <AvatarButton
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup
                  aria-expanded={menuOpen}
                >
                  <AvatarImg
                    src={photoURL || user?.photoURL || defaultUser}
                    alt="avatar"
                  />
                </AvatarButton>
                {menuOpen && (
                  <DropdownMenu role="menu">
                    <DropdownItemLink
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
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
          </NavButtons>
        </NavInner>
      </NavBar>
      <Main>
        <Outlet />
      </Main>
      <FooterWrap>
        <FooterInner>© {new Date().getFullYear()} Voca Drink</FooterInner>
      </FooterWrap>
    </AppShell>
  );
}
