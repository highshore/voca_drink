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
  min-height: 100dvh;
  width: 100%;
  background-color: ${colors.primaryBg};
`;

const ContentContainer = styled.div`
  width: 100%;
  max-width: 550px;
  margin: -100px 0 0 0;
  padding: 20px 2rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const Header = styled.header`
  padding: 20px;
  display: flex;
  align-items: center;
  width: 100%;
  flex-shrink: 0;
`;

const Logo = styled.img`
  height: 28px;
  width: auto;
  margin-left: 8px;
`;

const BrandText = styled.span`
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${colors.text.dark};
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
  font-weight: 600;
  font-size: 1.1rem;
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
          <BrandText>Voca Drink</BrandText>
        </Link>
      </Header>
      <ContentContainer>
        <AuthPageHeading>Welcome! 🥳</AuthPageHeading>
        <ChoiceButtonContainer>
          <ChoiceButton
            onClick={async () => {
              await login();
              navigate(fromPath, { replace: true });
            }}
            disabled={isLoading}
          >
            <span aria-hidden="true" style={{ display: "inline-flex" }}>
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                width="24"
                height="24"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                ></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </span>
            Continue with Google
          </ChoiceButton>
        </ChoiceButtonContainer>
      </ContentContainer>
    </PageWrapper>
  );
}
