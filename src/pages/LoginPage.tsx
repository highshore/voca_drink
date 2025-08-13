import { useEffect } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import styled from "styled-components";
import tempLogo from "../assets/voca_drink_logo_temp.jpg";

const colors = {
  primary: "#2C1810",
  primaryLight: "#4A2F23",
  primaryPale: "#F5EBE6",
  primaryBg: "#FDF9F6",
  accent: "#C8A27A",
  text: {
    dark: "#2C1810",
    medium: "#4A2F23",
    light: "#8B6B4F",
  },
};

const PageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  background-color: ${colors.primaryBg};
`;

const ContentContainer = styled.div`
  width: 100%;
  max-width: 550px;
  margin: 0;
  padding: 50px 2rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Header = styled.header`
  padding: 20px;
  display: flex;
  align-items: center;
  width: 100%;
`;

const Logo = styled.img`
  height: 28px;
  width: auto;
  margin-left: 8px;
`;

const Link = styled(RouterLink)`
  text-decoration: none;
  color: ${colors.text.dark};
  font-size: 14px;
  margin: 4px 0px;
  text-align: center;
  &:hover {
    text-decoration: underline;
  }
`;

const AuthPageHeading = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1.8rem;
  width: 100%;
  text-align: center;
  color: ${colors.text.dark};
`;

const Description = styled.p`
  margin-bottom: 2rem;
  text-align: center;
  color: ${colors.text.light};
  width: 100%;
  font-size: 1.1rem;
  line-height: 1.5;
`;

// Removed unused form-related components from the phone/Kakao mock

const ChoiceButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 1rem;
`;

const ChoiceButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1rem 3rem;
  border: 1px solid ${colors.primaryPale};
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  font-size: 1.05rem;
  transition: all 0.2s ease;
  gap: 0.8rem;
  background: #fff;
  color: ${colors.text.dark};
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

export function LoginPage() {
  const { isLoading, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // placeholders removed from simplified design
  const state: any = location.state;
  const fromState = state?.from;
  const fromPath = (() => {
    if (typeof fromState === "string") return fromState;
    if (fromState && typeof fromState === "object") {
      const p = fromState.pathname ?? "/";
      const s = fromState.search ?? "";
      const h = fromState.hash ?? "";
      return `${p}${s}${h}`;
    }
    return "/";
  })();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(fromPath, { replace: true });
    }
  }, [isLoading, user, fromPath, navigate]);

  return (
    <PageWrapper>
      <Header>
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
          }}
        >
          <Logo src={tempLogo} alt="Voca Drink Logo" />
        </Link>
      </Header>
      <ContentContainer>
        <AuthPageHeading>Welcome! 🥳</AuthPageHeading>
        <Description></Description>
        <ChoiceButtonContainer>
          <ChoiceButton
            onClick={async () => {
              await login();
              navigate(fromPath, { replace: true });
            }}
            disabled={isLoading}
          >
            Continue with Google
          </ChoiceButton>
        </ChoiceButtonContainer>
      </ContentContainer>
    </PageWrapper>
  );
}
