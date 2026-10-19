import { useState } from "react";
import { useNavigate } from "react-router-dom";

type AuthView = "login" | "create" | "forgot";

type RegisteredUser = {
  name: string;
  email: string;
  password: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="m4 4 16 16" />
      </svg>
    );
  }

  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function getRegisteredUsers(): RegisteredUser[] {
  try {
    const users = localStorage.getItem("resume_screening_users");

    if (!users) {
      return [];
    }

    const parsedUsers = JSON.parse(users);

    return Array.isArray(parsedUsers) ? parsedUsers : [];
  } catch {
    return [];
  }
}

function saveRegisteredUser(user: RegisteredUser) {
  const users = getRegisteredUsers();

  users.push(user);

  localStorage.setItem(
    "resume_screening_users",
    JSON.stringify(users),
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [view, setView] = useState<AuthView>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccessMessage("");
  };

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();

    clearMessages();

    const enteredEmail = email.trim().toLowerCase();

    if (!enteredEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    const users = getRegisteredUsers();

    const registeredUser = users.find(
      (user) =>
        user.email.toLowerCase() === enteredEmail,
    );

    if (!registeredUser) {
      setError(
        "No account found for this email. Please create an account first.",
      );
      return;
    }

    if (registeredUser.password !== password) {
      setError(
        "The email or password you entered is incorrect.",
      );
      return;
    }

    localStorage.setItem(
      "resume_screening_user",
      registeredUser.email,
    );

    localStorage.setItem(
      "resume_screening_user_name",
      registeredUser.name,
    );

    if (rememberMe) {
      localStorage.setItem(
        "resume_screening_remember",
        "true",
      );
    } else {
      localStorage.removeItem(
        "resume_screening_remember",
      );
    }

    navigate("/screening");
  };

  const handleCreateAccount = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    clearMessages();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (
      !trimmedName ||
      !trimmedEmail ||
      !password ||
      !confirmPassword
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const users = getRegisteredUsers();

    const existingUser = users.find(
      (user) =>
        user.email.toLowerCase() === trimmedEmail,
    );

    if (existingUser) {
      setError(
        "An account already exists with this email. Please sign in.",
      );
      return;
    }

    saveRegisteredUser({
      name: trimmedName,
      email: trimmedEmail,
      password,
    });

    setSuccessMessage(
      "Account created successfully. You can now sign in.",
    );

    setPassword("");
    setConfirmPassword("");
  };

  const handleForgotPassword = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    clearMessages();

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    try {
      const response = await fetch(
        "/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to process your password reset request.",
        );
        return;
      }

      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent.",
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error,
      );

      setError(
        "Unable to connect to the server. Please try again.",
      );
    }
  };

  const goToLogin = () => {
    clearMessages();
    setView("login");
    setPassword("");
    setConfirmPassword("");
  };

  const goToCreateAccount = () => {
    clearMessages();
    setView("create");
    setPassword("");
    setConfirmPassword("");
  };

  const goToForgotPassword = () => {
    clearMessages();
    setView("forgot");
    setPassword("");
    setConfirmPassword("");
  };

  const registeredUsers = getRegisteredUsers();

  const isReturningUser =
    email.trim() !== "" &&
    registeredUsers.some(
      (user) =>
        user.email.toLowerCase() ===
        email.trim().toLowerCase(),
    );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 relative overflow-hidden">

      {/* Background Animation */}
      <style>{`
        @keyframes floatBlue {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(25px, -20px, 0) scale(1.05);
          }
        }

        @keyframes floatIndigo {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(-30px, 20px, 0) scale(1.08);
          }
        }

        @keyframes softPulse {
          0%, 100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.55;
          }
        }

        .login-bg-blue {
          animation: floatBlue 12s ease-in-out infinite;
        }

        .login-bg-indigo {
          animation: floatIndigo 15s ease-in-out infinite;
        }

        .login-bg-pulse {
          animation: softPulse 8s ease-in-out infinite;
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">

        <div
          className="login-bg-blue absolute -top-48 -right-40 w-[620px] h-[620px] rounded-full blur-3xl bg-blue-300/30"
        />

        <div
          className="login-bg-indigo absolute -bottom-56 -left-40 w-[620px] h-[620px] rounded-full blur-3xl bg-indigo-300/25"
        />

        <div
          className="login-bg-pulse absolute top-[35%] left-[38%] w-[360px] h-[360px] rounded-full blur-3xl bg-sky-200/20"
        />

        <div className="absolute inset-0 opacity-[0.035]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
      </div>

      {/* DataPattern Header */}
      <header className="relative z-10 px-7 sm:px-8 py-5 sm:py-6">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="inline-flex items-center cursor-pointer rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="DataPattern"
          >
            <img
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcwAAABpCAYAAAC3fRNvAAD3cUlEQVR42uz9d5hl13XeCf/W3ifeULk6AUTOAEkQzBkUk0hRFCXZEpVle2zL8tgjfX5mxmH82eMwDmPJsiXZkk1JFC2KSRQjSDFnEgRBJCIQuQF0ru4KN520917zx7m3qhoAgwjRoKTeeOqpQtXtqnvO2XuFd73rXVIUBWfWmXVmnVln1pl1Zn3zZc7cgjPrzDqzzqwz68w64zDPrDPrzDqzzqwz64zDPLPOrDPrzDqzzqwzDvPMOrPOrDPrzDqzvodW9N34pQqogKIqIIIiqIqCoACIzl4ts88y+39Fpv9enqTboggBUAWR9n2071y2r3DnWmb/YtfVnfazb7y+8atO/8m3fyf0tHv6F2U96j7JaRe761v6PfOOH/3Evvn7e+zz1W9zBz3+3frTvLtdO0Zp97yIhOl+fvLu3857FOS0W6ci2zbmtOvW6Wvbnz6hZ6e0lks0zCzS479m++7p99wePLP+vDhMAWdUgygGVaMBqx5DwKpiVBGduh8100TXaLvxDAGDM0b0O02A5YltW8Fj1SkEglhVDCpm6jinR0WDGgKi7d8KYghiJUyvw+rsWD++STzNwcqjTr7q7tChffXUmH0jMzr9fTL7M/rn3Gma6WUG2XUXpN01uy9NANHWdApgpvcuPImX3wZ8BkVUUJk9z9P3WDjNae1+vipCwIrKd34RraH/Ju+wDV51Ghju7EZVFKNIJOFJ2kOKotOI2ujUMqhs31uPEAwaRAjTe2R0ZkWk3SXiv2PnpQhOYkUEi8OoF6MBIejO87Uyfc6qCELATM+8nObuz6wzDvPbiHCNmqnraF1I6yhBdMcJsG1YDIpFMdNNKE9sw+kTC4533t/0Q7Yjfm29m572Gjnd9P0p/vQsaNBvmCHoLMKeeea/BEt2fSW6OwDS04IhkR2bKNuoxU60/2TeLp3u9GlCJKq6K/t5vGyvdZayjcs8kU2s33qHb+8n+d7LjGR2LFqERxRM+zVBdsLL3XmknpZlPsGrkRkutvN05PGCVTk9y9QnhAucWX9pHaYNhtTHmDA7+AoEVBQFnEAQlWAEL2gQg5c2X1Npo8U0NGJDeJKMHQSx02zXSsCg27mLqmBawHl2QnfBV7IrN/zmNiHsOtjyjWGh6asUQWQWd+9kJNODK/oosPjP89qBtXfulZm6y0cna/I4d38W4z+5Nl8fx27vhvJlV2T3WCSiDc/Cd/i3HwfFeJzXqMwy810ohuyGZJ/UPaAyTRZb5y67rggExOyKNKcYlZjtAFQfA9l++9m5YvCAYNTLLAt/dFAtGqbeW/4swvwz6y+rw3yseRCCGFQgCOLbz+pNC53NPnQKpUWh/dftpv0OE0zlOz4wQAuJ7RwD3YGHdfafTM3ODKYRtM0Fv1V8u9tAPR5epyLSZtyyK2vVXdlrC1ntCrb/gtUudxt6nZbVFFSnKKXuvK6tW03906NN1pMd7es3ePac9lwfP7f+xvD7t5HdCo8TQOnpe+xR/0i3ow45DWV58jAGPQ0r2kZjVETFTM/3diFHVWaFHaaw7RN5bq2jnCFk+vh3uQ2jRbfD28fku2c8zBmH+a2XF6WOm+2Yayf2mlVJ5FHOTLG6c3Aj9UTqsOr1OzZTj0U6/xTO0hAkkiBWd0f97DLguuM85THH/BsaxN3OUvXRr992ESoaxO72h+17UH3cPOLxCAf6FyDLlNPvq0qLQZxmkHRqLlty1veGm3yU6ZdvtRG1BQlEp3viicJ6Atu5z+PBjdPSwukBmehp2a1VL08mvKiPW5iYftY2JDA6DRynkK1ViHRK2ZvWGL+z+xewTAO0RxH8ZnZs57z50+hRokFnXIIz4OwZh/ntbXZRgglT4oXQZmfTjzYLw4Qdksb0Y0qTmDJURfBinsCB+84DvICVIJEGDLvNy7YBbE3KrtL+Tk3TTMHAR2eHPG4e8Vi27eMRBrarTa1R3a6F6WmQZHvAt62i/Hl3mjPzqNsw2Yy9fLrxMtv34nRD+ySbqxbZlNMd/De/1nar7Pau+oTu3u6dIo/yzrM9tbNPzYxY1TqiJ5ijPdFgaTdYvQOx74avp85syoloiyazaxcE8x0bgDZzdGrYnTtuM2dlJ2uf/U094xvPOMzvfBlVEh92Qlp2pXwqGEVn7Dej0/0WgrY/D2CFOkmkst/5kdUndNplO3EUFQxBZtmNyg70N3Pvbb4cMLso6GE7q9bHOM2djAL9Roy6lvyxXaJ8FOXndBbtjLW7y5GoYv/C4UFyGtlqJ6PX77n3uQvm/BZEED0Nhm3jSXk0GvkdvgN5TOg2/W5LLzqN5dn+PfM99rRP+99pMPGtKD1PkPHXBmdq1U/PsZ0iTtMSzaNYCi1z9nRkR89kl2cc5p/WYdpt+MxMAUwVbd3kNAKcHc9pQV1C+7VoW84Xiz7RDPMJHNYZ0GcIYtVjpgdIpxQULxHMonJEzdTDzmAiHqdva8c57sooHi+f3F2Lk90svNm3RWQ3IUR3GJYzp97G3H+efaY+JjyA2V3eXcM0j3JJ+j313v80sOYu1yZP5ErkcZCM3SWAGVzRdkdrS/CRNkQLavheIq/oLM7eldVNn7eEGXVgmmWKsN2u9sTayrb7sFEigljxEuGnhSOZ1jgtfpqbh1040+k0tDPrjMP8tg6sFQH1bcYoBpWgwQgSWTFRTFlXuuNYZu0bLZtW1CCqmuo3zpLkW/So6RPqShGiKKGaVBpJ0MSqqK9VrAEbS13XaiIrbteBbgmsbXJgp1cUJTFVVdE4r91uV0SE9Y1NnV9YEGOgrJyWZQkiJEmCtZF479U5RxJbRBBro21uSwjgfVANXpu6ZnGuL0aUupjQNA1ZHCGiFGVF2ltgUtWaJIlEUURRFOq9J01TMcbgvf+e3pgagiZJIkVZapanUhQTRKDb68twNFAA5xxLC0sCQlXVBK8E71REMJF5Ui2WEB7jtnavsix1fn5enHNsbGzo/Py8pGnKYDhSE0VESSZioGmcNk0DQJIkGGMkhKDGmFnohKqi7SKEtjc4iYxICKgGNHiCbwM+awRrhBBU4yiSoJ7GBcUYieJUnPdUVaVREn9PBB0iMqUwtQctTO9smuU8fPQw+/bvF1RpykrTPJfx5kCzNBHdZSd22wrd5rp/C5eaZWhRMCpKestz1A7dHFX0eimu8vSzhGo80H6eiGh7jqM4bWF4Y/DhTI75F3HJd2O8l1EwPqhhp39ORXHB4dTj1ROlyZQZq+3nttUEBawKqRNs+I6t1RPOMGObiqtKjbTB4sHXEEUQpbgGQtqXmliDtJwOo0qMk1hrNaKULpDkuQA4H7BRQuM940mhnV5fRuNCs05OEu803jhF7bRI6podNr2yTV1syQ4CkSCDrYlWxYheltBJY2QmDhHFlE5xAay1YkybqcdxjKoyHo81SZLv6RDYTDWiAhCnCZOy1s3BkG6/R7eTCkBVe62KksgIk9GIvasrEllDcJ7aN0+qsZfHEJNOX957TdNUVJW6bgMb5wNFUWrWm5P1UaFJ3iHPZlXaFouZITOV2x08nv61AVzpyJNIBKWcjNUQ6GapWAuhqbVpatp9ITTOowg2SrBxLMYYGvfkBVQq4Kc30AYkQpCgzJqxnIBJEiZNrWqEThKLKjSl024aiQHqut5FA9sJLB7tOB9/73ltxptkeYdKMqlMpmQ7bU6TCSx3kHI00ZSGLI3AGFEftKw9GIsYeybFPOMwv11zEeO8VSNgDWKByOw0mqtvEGum8Gt7CGaqHbMKRKwVok/g0D4BpymqigYIDrQCbdqvRUAjCDE+7ktJqk4sgVaYIcZJHGq1EqicI4pTsXFM7QIqlqpxauMUm7QmbnOCrq0PcAEwEY1ve7+yOKITA8Hhg6IYxFpsFBNFlsjCQre9TxGIASwwGY01uIo8yyQgRFFMCIGyLBUgz3MxxlCWpVr7vXugBXBVpVneEYdhMCm1v9AVD7o28BxbW8N7z+LcHPtW+nQiZLg51jy2xKJihO299OS8/5mSlarKTovHbtjVWov3nqBtIBNCoKpqNVFEnKdSgq4XsLY2RFXJsoxZVu29J8/z0428MRhjsBaswGq/RT5iac+fBULj8U2hkUBsZYr+tAFf4zzOB8RYkjSVxocnDVZUILT9GmJazgNmWnTwYnHG6MmtASt75tkqlcFwBAHSKGH/ciqTkWonDmJw3/hvfDOHScCVI+3ML0kjEcOAHjzuWB9O6HZyLjk7JgWsR/xkS7uJRZJYtPFMqkZNlIjIGX95BpL9tjd8gKiFFEUBV6qvJpimwIS6dYRxtG1ejBgMlu2jLQ6YAN8kS/g2RA2+8y07bRCNItAScK1zdx5CDNkCRhsViQSxqrorp5jmi1ka0zinvkEa51VsQsCQJSJbBfr+6z7Kl2+6lVtuv4vKQ3duAUxEWdUEV5Fqg6jDBVqJAzHYKCaOE6w17F1d5uqnXsnznvUMveCcs1nox2TdLrF2xTlPMRpor2tERLDWoqpUVaXGGEnTVJxz38N4rJKnqRgjuCCMi5p8oav3HB7x5re+nS9cfwPD4ZCnX3UFr/6+l/LGH3yJpt0uWpWE4DRNU6m8hyfVaE1rhlNa8+P1yaoqTeMUaWHWOE0lSSJOjb3+1tvfzy133se9996L955Op4Mxhtlz897PoNhth2mtbT+MMN/r8oynXsmLXvBcvfSCc5nrxMQIWZSLjQyuKVHv1VqDiWNJItCy1Ma1kKyJ4idXXHC75VanJKWpIpixBIGVPfPce2iDX/313+RTn/kscZRy9VOv5ud+6mf15S+6GG0sov4xEOy348gUAROjEnFso9I/+vCnuO7TX+beg4fI05iXveDZ/OLPv5FL9udEWUfKYqh5W+ZQG8Viopjg3RnvcsZhfpvuRgqN7CkspdpQQ73B1uEHWX/kPsJgnZxApAEbFLAoFk9MICZIhOCIGGO/icP8ZhHiE+3Hq0zOIFpBoxzTjMlMIIsMk9phukusnHcFc+c/FUOyDSHp7vclCsZI8JUKoqgSxbE0jWoAbrr1Tv7jf/lt1jbHDEqPTTvo8SFF7UEMaWxJxSHBodJq6yoGjAExGAHz4DE+/NkbyOzvccUlF/LaV72cV33fS7ng3DlNEws2bjOYEDSKIsmyjLIsKctSoyj6ng5/BTCiDDY3NVtYkb37F2WtRH/9v/8+b//jD9Co4KuKBw6d4K577mdleYVXPP8KOnEmWigE923L3//PuBZtE03Z/X6cc9tZoaqqD4E8iagbzyc/8zn+82/9LutV6xDTNEV1nbosEWvp9XqEEJjVLLVtYdn+fUYM49GEz998N//tD/+YC87ax4//8A/wk3/1tWQJnNicaCcxaKNI05AENI4TMXEqVpwGfeJM0yd6zyAoGhBs2yU6vYk6lZ9en8Cv/Zf/zkc+80UaH5EnHT7+pZs5sl6yZ/8/5+nndnX67x4DxX5L/gNC2p0TB3z19q/zpv/xTu46dIqsv0h5fJ0HD76LAyvz/J2f/RFdTmOpxoGmcRoUTBxPebNyRibvjMP89lcIDisNxECsNKM1jtx/O37zOKu9jFBMpvKolkCMkxQnCZ4YwZNogdXvzGHO4NjvdLvWJqdIN2mI0MkmnVhIrXBqa0S+cjbze88CdYgE3d0ftsNiVXCNqvckqRVP0DgyFF4ZlujHP/05Dh4+jsnm6CwsYdIehVckCpgoJk4TfDU6jZWrYghKK/+srequ7XZQE/ja/Ue44d//Z970lrfxU2/8q/z8G3+Yc+Z7EgPj8ZjxeKxRFMksA4miiLquv4e3pVIVE50xHwPo4RNjbrr9bkLaZ2l5D91ul2OHHuLuBw/xlVu+xitfcAUhgHqnqg6iVJ58puJjFV9mz9Q5p3mnKzEixka40LJETpxY0/e89/0UwUDaIUtTut0uIkJZloQQMHGMb5r2DOiOkIanhaIRS7q8RPCeoin42sFj3POr/5UPfPij/M2f/Qn94e9/LhbEhAzXNFo3DS44jeNITJSIPumEsF0s1eCnMamZ6k6jauCuex/mw5/4NGubI+aW9+DjDiNXcMNXbuOrt3+dp1/wTHYjsn/aDHNrOFFNe3z8M1/kzvsfIlo4i3x+BaKEYv0Y7/nAh3jDq69l6ZwljLFEUSS1C6oIznu1coYme8ZhfttgVCqBvep9TdcC6TzBHqGWPfSW5zj/4vPaQjngJKIxCbXJqCWlMQkopMERhW98cL+bLFmZunHrS6QakmYRTEbcdufd+NywvLIAuKnAwqy9dBbJTj9UMQISWbRys95L6gbuuPteegvLhKhDRUxRNjiJMVkPT8SoarCmgxBa0rqY1krIjk6mWEM93KQgMNdfpJt2OD4Y8qY/fDef+uQn+Pf/8Bf1WVdeJHmeS1EUWpalxlNCx5+H+kqapqR5JBOnDCrhkSMneOTYKTTusnZ8nZPdCjRGG+X+g4dwQD0qtW8hihPq8OS+/8efWrETXImxhBDwPmgUm+02kklRcvd995P1FyhcQlnXlM0YiWNEDKHxMB5ju91v2L0QsKiPYVgivT779hxg/chBPvfZLzMpSjY3N/nRH3y1LnWROI0lYLVpaqxYRATXOI2teVKVfmZwLAgadGfcX6t9wsNHjlF6mF/dj5OYiRMW957NxtoGDx463hKkRLad5beTWe7+63MLfSlATw0mdBdXyZb3cWptHSSQ9xd4+MgxJlXdcqHFIHEMrsJ5r0++9P+Z9ecswzRENpaiMtoYJHaVujpgMCyvnkX2tOdDZw4kIjKWSBJyk4KJW9hRBfwsnTodqNnRQTCPid63/39Hp2qXgPWOZPO28VIP6tjhHwpI1H6v2mzrl1pD5GH9GNmDD3NytEUzWCdeDewoz1hMy1CVVpLZYiODDS3Ts2lqTO0wJiLJYFI1bI4rkn4f4nTbuaYWRAK1b4imB90TMGpaIyiCmLaTNbiKpN/DopSuxjWA7VJVhvFDJ/mH//JX+Se//Av6shc/S/pLK4JXUIdzjmIyVmut6DfJinTXTAjR3fJ0zIaGPCaEeXx3MVOmYBcRS+T0nrVdjeCqGIJioCpG6iOY6+UsLy0wGm6RLR3ApB3qumZ5aZGxHzMZj4iAYCASIdQ1EqXf1Gydrsyoj/q+TvXsdvX0nabw8uh8hMfIqO20lZhdr5pdq5DEkTjnaNsRkim5C6KsA3HO+okJZq5PPj+HdzVNXWEFsjwn6nUpisn0GEzbJsSwu/8wznNKY9G65OjaBmnao3fuJTxwdJ1//au/yUWXXMIl556l+5cTwZipPJ5gzIyJGmn77tuRCGZbmGN2wx7VK7rt4Waary3ZKcjpGr8z0XLDTGhjxn41EmaTi1oJdRHcdOf77Xqk10y8oN4HGi+IRtikQ1U5nK8xkaGpizZYRdv3rE5nClmya1Tf7GPnq4DRoEGMjMaqUTdlMBgyXt9Au3sAIev18eN1Ot0+UZxSN+CnIi3qG8RAlqQyq2Hu9F2fjjLwDWZsziQA2xGIbff67D7vTgJ2sIup/PujpM12+pUfK8D5+NjH6WIgojuj5mbaxHraSX3U/n+Matnpchnbe18fo7u7rcW9MxxtdyT4aDW1x777R88i5rs4Nea71IcZ0Kamk0dS+UZj6+lHI6LyGPgE1IKugPRaX4XBadTyeMRhVIn8tNdE2GV4ZjfUoCJSVrXGSUaUJFJUlYag2CgWp0FtmgCBmLqV1JmKDTRiVQFflmTUdFIPoYZJgUYZPp2Tsm60F/fAl+DK1mGGAY3EWFNjJYC1iLGIKjGeFCftYUukUZ0yDmP1RaXdbk+a4LFRJE2Nmjgj6S6QdBdYX98E50jyCDPcxI23SA3EeZe6CXjnEWNJ42SbvBO8o9PpUE5qbJIhJqEmwvQWCUmH4cmj3HJ4ws/98r/ibW/+b/rsq/bgayGzkfQ7XXFNqahXaRnKu4+hCgEViNNUxpOJeteQRhGJtRA8FjBxiwJQ1y35qjWt054gC3Eq2Ii6LLSuJsQW0jSGKMJ7T9UENUkmVdVo3ulN++hKTawRq0EtAeoCo4F+J5ICcJNNXezGTKoBSZwTW8W4CX4yINamZQtHBkJopQxEKBqnSZqKiLQMVGNkxk5tmlrTNJXIGpxr8I1TM+1RRD11OSLv98BY6nGBUzTLOyBGJkWhvX5fqqJQ11QksSWOozbw8g400FQlUZJClOHC1DCbCFS2eyIlqPa6HWkap2mnQwU68gZnc6BmaX6Vkw8/CFZIrFIP1rF5QuVrsti27zsE1FriJEOiGB8geKjLMd3uPD6LKMc1IU7xkqBicY3wd//BP+Gdb/lvLM4nmlpI4ohiPNIsTSRJEhmq0dpBKkI/McTa4ItS1TXEkUVspMG38pfGWlQDqG/L7HFCPS41inNRE1N5pfFtxSIxSGIglGOixLbnu3Y0EmuU9qUi1qJumOt3pC4KckqsG7fRpK3Vj4fkC6tiNGiSdhjUQhJFRJFBXEXHVORSEYP4ulJtyhYhiiw0DeoVNZlWaiTJs5ahrrB58rju3bMoTLYg7WjjAwYkFtU0TzG+JskTQl2RRhFlOaZxAedVg2/7zRMJhFBD1WiaRAQVJrUDG1NUDYuLC7Kxsanz/a7UxVh7nUwIgclkohhD1umJYijHY+1GETR16wnjCCLB+enzFvAhkCYpokZd7TBiibKO4ALlZKJxHk+VrrcrwigiPoSp/zOkaSpNXdHUtQpKmsSSJDFNMdGmGNFZXMCXFZOy1v7CkjRemZSV9vtzsjUcaa/Xk7oqNbZGhoMtXV5ekqacqAbF2kgmRalZpytBhcgmoMpkOND+Ql9wNajXUBVUdYNJMk27fakDjIpSmaIdWRpLGltQpRyPVAhkWSpVWaqxEYoRr4qYCJskBIWmrjUSvisIyXfJYc4yL5nqyQYiCmKdYHAtG9b0KM2CtMo44KfiBpYSIeDFzobmTGMls+MsEZLMYiWVIIYmgBIhBqyNEEEKN9OaDGrUE7A4YymnMXCeZ4QaqIdtRikWtSmNyaijjIlFDCloppltwGT4qSSBbCt77EQ+Vr0apsLtCILHSJjJkLQKPNvRX8v8HIUhi/v28+xnPJ0Dix22jj1E3AzpdzImVYObxuFi2taVuq4ZD4cURcGxo0fZXD9K3Jlnaf+5BGsoN7cgU5hbZTQ6TqeT8n/+3/+O3/2N/8D+BSGKhcH6UPM0YgYCykwNcxajTfOojc0NnZufk0i6GJSyLDS4tgE+jEt6eQew2CgV4gQwaFVrUzuCc6pWyXs9STo54AjFSN1kjIljsiyj0TY7qptGrTESx7HItMHeWoFOX6QotQmCN6iJIrIsYzxxuKqkrhvSfoc0zYjiFA9UdVBjDDbOZVw5FZtQ1E7TJBFjY7FGiJMIN2602+lI8B7fODQEbdml7di2ELzmnR5NWbdtFt2+2ADjqlExovncomwOR5rEseRzXYwoWhdaFxVGlDiJiOcXwDmKsiZIBMaohCCRjcjyFFdW6FSkY3b/w7REEcRCgJOHj7D3wFk86+or2bPYY+vkUVwxYKGX01QTVH0LVYrFI0zKhq3RmNGkYm19i6MH74G0y76LL+fU5oBic4O51WXGxYS1rTHv/OP38ws/82OctRRJMIJJYiIDw2KiZD06HYiCoZwU6lxJL42QTi4ouPFEMRE2TkQiiw+OspyoOk/ka+Iko3aqlXOYJCPL28jMlYHhaEPnF3oSNtfUaICFRWIS2RqO1NkOvflURiWamARjPBC3rV21B0lxCiZKGE0aorll1CRoaEjimK2TWxhpy5dZ3hOTJmhdaj0Y0jQNJsqIRGmC6nhrzHBScvb+ZVlcXhVXlfjG05RDovl94kBVLMbabQSqcQ7vavIkwaY5cSZSFIn6Rmm8EKcpIlBVJY1zmCQn63SlDiP1QJ7nUyJXIpPxWI1Ap9ORIIairFRNRLc/L9QOglGnftrhpjg1mCgiiiMxs+bsAGpUy6rG1k6zJCfr9yU0he50eO/MlRcjElQ0imIZF5VWVcXy4ryAcvLECc3ShDyNyDo5NA02SelnXXFqqENQ4pyxQzv9nnhgXNSsLM6xuLgkdVloXZb0ej2pa6dpnkuUpIzGla5vbrIwNy+d3rwMTm1oqCf0uzm235O8K/jGszkcqyQ53bne9jsvJk4HoxGJhW6WSmzAe4cY24p4iEG80jin9bQtyhjbood/XhzmnwVVYjqpT04DL6bOV4CmdFgN7cR43xATMEbAtwhCMk3NbSinGKLFa0qkHbxYcjEi4hRft3SJOAYRqsapCwbsd1dX0xhD0ulsH6ALLriAl/3kj3D5ARgMtt8OErXxRXsIoZhAOSm47777uOf+B3jru97LnbfeSPqUi1nYdxabYwda0+3kbA1P8pUb7+e//d7v86/+4c8zqdEk707701rtXrMrCt3GcgTm5xakqhrdKseEoKRpTrc/vz2z2QHOt4/KtGqHeMmQHCKDeIceOzVWg2N5sS+2Oy9hPNS6ceSxEVUliWOp6kbFRpomifi6baAnzqSqGiaakkSRFgprg4phFaiCpTe/hFQ1tQYqInzUoQZN5zIBmEwC6XzedjS5llVZN17L0ZDlhXkJwSNG0CbgglNrI4miGKRVQPJYifKUmkq9Qiwp3qKFSbCxQQSN53oAbNaoAZKoJ3auB9NRdcVoU4N32Dgn7/TEeyiLUr2rEI3E0qrwzALLRyvkZnlK6TzzvQxfjbn8oiv5wf/19azksDWALG4FLEwExk7/ZgXDMQwnji98+Ub+5BOf4fNf/irjzZM0pYMsxUxVaGqvvO2d7+aVL3k++5fOJyiaRJEIHlxF1EQYjbAoWWIlTnJEoZ7UWtWO7vyi1AFK0BAgaIR0MhLbOsbKQZxBi/OgpyZoUwe6iWFxeVncZKhRb6ENVsuaQNBupyO1xJSFahQLRqyMCzSzHSJD6zCyrpSgprMIcY5NMqqiovE1ST+DOCeZW2YU0NqDlYQ4TSTO57aNnQvQMZADwUSqwLjyWpUNSwt7xSJ4i255GHtDUStMSki6RFmXVFJOnXqEta0J9VM6SmeOOgEnGT6C4JVON5NQTtTNgOcAVVFpJ0tkMhpqL08k7nalrmsdTEqNs46k3b6UDn3k5FB73T4mikizbRohClopNG1ZF1/VxCJ0O7mknTbWbSalNqORJlm0Hfy2+2z3+Aih9kHzTiZEqbqpjbWdOfJeLk1VaZJ1ZGtzQ50G4izSYCPitO3nLRysbVS6dzFFkw5lAK0blQC9ub74xmucd2U4rrTwDWknlU6Uqk2nezztsrC8KAB1UehgPMKkHboL8+JAT5VoWXqWFixJJyLr9GYzMChdK+6RJjEutC1zNhJUgvgQVATiyEho3J8fSPbP0mk+FtPeNdY5EcHVih+D1XYESlOBBmyat7/FVNPYPcKalK5xrRdqnKIN2Krt9DYW42tirUjzrrRYzXfx+qZEhCOHDnHktlv4+s3X07N/jct/6FkYgfl8ivDtAqS7KUgKuphz/v6n8v0vfSovecFz+Z23vouPfv5G1tYewSQ9bJRiE8toXHDOJZfxB+94F695+Yt54TUXEscJ4gR11elTB2cyQq04t4jEuOBJ8znSNJEAjBXdGASaAKc2BgxHBcNRQd14NTYizzssLCywOJfq3kXorXQxIMfWJ4or2Lu6KKnA5taGpmlGksZSllVLmhDB+aBRFAtxjMYxddlefyWg2Rz91QNsHD3F5qQCDBIUsTkjH3H/Gqz20QyoG8Pag5usri7gqoa9y7Hk3USaJlUTWbrdjuCnOqDT+l3lFK++HShnU7bGSpynWNNed9XAxBuOH9vixIk1Tq2vY0S01+uyb+8e9q2uaK87FYMCOr0FwXl1ASaNqkEkihMJdal1MdFuFqHqETVTvfWd6SGtgW2IbMLBB+/lnhs+w6F7b+PA4v/KD1x7KbFCL9m2h4iCFaSbossp+KWIy85+Hq946fP4zTe9lbe++wNQOBafcj5bm5tk3T65ZBx65D5u+OrNPPOp52sUFC8BEzzdPMHYIEU5UESIspwQYFTUiknIl/pSC4wbdFLDuILBaMTaqZNsbm5oXRQc2LOCqJD15lndt4flRUg7hggY1GioleVeKgTRsipRC3kvxmAYb43xlWCMUVFD1utIAwxK1AV0vYK7HzqKJB3cjOsQoPFC1Jnn4eOb1AZGRVs1sGYm7+zp55Z+hoyLoElk6GQpk0q1wdJbnqcEXR+BzWCjgHxxlbn9T2FQAVhc43Gh5sKLL2NYe07Vbdt4KWjT6o5ggmCs1azTF181OpqUrVzjVKULDRSteAhJ2pFeHjEoaj25PqbT7zK/2qcBRh4eOljqiRPHGY/HhODI04Q8TThr/x6W5nus9KECqlLVlQWJNeSdrgRtYPdABg3IFOZELBtbY1ZXFzCJcGi9VO8cS0s9GtDN0rO2MdCVlRWSSMSDjmo4/MiIg48cYn19g/m5Pk+/6gqMb8g7keZZJnUx0aZxOhoXNONG55YWpPZoLWglMBigcz3QLGHk0MHWhCxL6e/JxYE+dMrp/Q8fpvaBYjzBCGRpwsrigp59YJWlHpjYiORzNBpQ71SCJ4msWNtmnKoK/rs3aed712Fus093O0ydDnMN+GaiJniatUNsHTtIR2py46AeIwSCiRD1iFbbGaaTjML2cBLjnaebWmI/wYjgow7rTUTd28/quZeriXL5brrMfr9PLUJvbo4JgUcOHuQtb3kLL37mlVx6dk7kEHU13qv6AE4EI4KVliCURFbGw1Kfddk+ufxf/D39J//qt/j9d7wPfEN3cQ+TssHML+CMZeICv/Zff5tn/fd/j9aqHdtOXpBptr5dJteWjINYJoVTE3WQGEYBPXqy4sZb7+SzX7qRO+6+n+MnN9gcFQxHE9R5sJZk6jCXejkvuuYqrr7iIl7wnGfqBWd1iOgwKFXxJUnWxXuH3TEi0jQNQYUoyRiU6C0PHOVDn/oCX7jhJtbHFRO1PPzgEejOk80tUlU1iTWEKuXGO+7jl/7xv2N06gQ21GRpTKfbZWV5gb1L87zu1d+nL7jmAunNdaVpGrSpNDaCtVYEkdIFrb2HKCXKBLUtjnGyhPsfWOeL13+ZL15/Aw88eJDBaEzjPMPReLtFJ0kSFhfmufSSi3nRC1/Is66+gmddvqRZ1Mpzj8eKVaf9LJI8zyVUbY9hC957jJptTSuVdn5smsWYOMeXgc6+FR556H5+6zd/jec99T+zfzkWbVCm8KAPAS9GrY3bWo5pzeRFK/D/+4Wf4viJ43zwuk+20zfGY+I9qxit6Cyu8JkvXM9P/ZU3sNKzhKahLgudm+8K4jQWoS4byrHTYDNsPodNkRL0jgfH3Pb1e/n89V/h1tvv5NDRo4wmY3wIxFaQuiCOIuaXVjnvggu58sorufqpV/HMp17GhfsMaTLH1rhQ4xyd3hwiwmQ0VDURi/O9FrGYhrpDRT/2mVv5yKe/yANHT3Fiq8TZDO8UjCPu9wm+oXINGuV8/As3cvOP34T4mjTvkOUtSayXxVz7/Gfympe9UC8+e45iOKHbySQ4r51uzOFN+KMPfIxb77ybu+6+m7nlvXzxlrvaKDXtQ5q3EpmN5/6v38u//g//kV4MTTHGxglNEOK8x2I34cde+Xx+6FUv1W4Wy3iz0PleVwyBuizodnIpy1JtlMq4clo0Nflch/k8YbOE2+48ytuv+yQHj5zkgQce4NTJNeqyQlBSa0isIYng0gvO4bnPfDovePYz9FnPuIrlhQ4GZDCqtJsYMWraoIxtAtG2w1xZXeCug6f0j99/HV/80pdpvOPZz3wWP/yG1/O0S/dSdTqECI4O0Os+8kmu/+qtXH/jzTx0/0FIUyIDe5bmueDsPfyNn/ox/soPXqutBkdgcWlFSoQG9D0f/hzved91bA4nHDjwFF77mtfwA6+8imEFvdUOlYMPf/4u/cgnP83Nt9/FA4eOcvLUequLjdLrdti7usLZB/Zx1eWX8orve6k+9+nnYDCoJvhKqVyjifVERkSDo3ZO4/i7I7zxPQvJbjvNnc8q7dwtRL0abaCecOKRu3ng1uvJ/ZC+bTD1iMQKXhWDJw4VBo8XSyMZhenSSELwnm4aEcphC8MlfYbSpfOUK1ldnMcunkPAfteucWt9HSQlWlqm0+lQlAkPPfQQp06dwpx9NlYdkfGkUSSIbYv2GqZRhCeJLCYVOXXshGbzK/zy3/kbBFX+4F3vxxcZEnfJ5+Y5cuwoe1b28tWv3ckXbriLVz3/cmnqQNQenRkJb3rPzbQeZrUKSieBYxuBd/zx+3n7ez7A3Q8extsMm/UgzmhCAnkKtt1GdfCcGJRsjku+/pa3k8bCs695Gm/8K2/gVS97Dnv6QnB5yxqejko2QBTZVvHGGLDw4IPH+OV//M+58+Axyq0RsrjCwt4DpKv7qJxSTkoIStU4CLA+LLnlrgeoxwNiCeRZwubgXlwxppsajhw9TJ7+NX32ledI3TgNdYUaQ5wkGiSSgCHqpJiohZqHHm742kne9u738YEPfICqLFnZd4A061BbZViM6a+eTRRFGNv2tD60NuShh7/ERz97I71uwhtf/wqufcGzuPYlT6XbFWIiyklQDRX5VJZO8KDb03tajYNphjk4uQadOcRXHFiao/Jj7rv36wy21nnK8l6MRayAxNEUXVdUAyFUaBAmVaFNk3P2QspP/ugP8ekv3khTFdDpMqlqKlcxN7fIbXd8nbX1DfYvLIt6S/AevFPceLojDGmnJyQ5NfC5Ww7phz7xOd7x3g+yOS4pm0CU5eSdPvnyAt4HvKuIOo4sTalsxJe/djef++z1ZPN9Xvai5/HyFz6HH3ntS1jMczKTi0GpirFiBGvAVRPWN4cqcYdssc9HP/c1fuN338aXb7ubplToLbTs8igB79vJtKr4oKR5j8NH11iPW+ekNsXECW5rC0ab3Pq127nhS1/gzb/+r1qBECuYLJatCv39P3wXv/amt1GMCrKFHouVQpKSzq1SNbQM/kZbkt7yMg8+chg3GYAG1CZUXsBm9HLLfV/7KuJrfvyHX00UT6HwqmI8GujKyookeUdUoqmGLxQKBw+N+aP3vI+3vudDnKgtzrWtZFlvhcXljNA4qvGYcTUh7/S56c6H+MKXb+LN8+/gBc97Jq977St50Queq09ZSnFN0EjCVLnBTXfWdEaoMRzbqPl3v/rrfPbLN+JCqyf81Tvu56t33MM//6f/F0+9eJ47D5X87v94Gx/8k4+xPqpwWJJ953LW/gOcWjvG2mCd4V338+73f4jLLjqfqy56CqEaMalqhqT6lne8n7e+493c9+Ah0rzP9bfey813PUAlv8zrXnEJ9x2H97zn/bztne/k4OFjLO07QDS3StQY8qx9tmoNh08Nuf3eg/zJp77AJ794Iy95wXP523/9J1mZhywTgkvwdUUkEFlBnfKNxib+xcwwZQcpDO34vrZ0raiICuoxvQxCQ8c22HqT2G+R2RpTbdGJ2yZ/iyMJJVY9KkIjCaXp4iTCOUdfYprJJrVzaFjE0GGuWSZLK9BaG/LvWsNid24O8nmwEeV4SJqm9DqWOI4pa/DFUDPxmDgFE4kYO50b6jEEPXH4YfacdZYs9nJG5YinrMzJj7/hdfrlL9/AnY+sES332l7EOKPwQhJ3eN+HPsrLn3+5okI0LRDvqPcaUbEEIrwIeQ8+8rmv85u//Sa+cMNNhKTDwp5zqIkZDCeIzdrUMIpbhqgG6qoEV1N7z9yBc+gmlhtuv4fPf+kf8/2vvJb/45d+kWsuWWI0gV4S00zl3eLIUtWOOInFA7fccRf3PXQYjbr0zm6bxUeTkiYAjQcbk84vUA0G4AMqhjpA2punKcasjyr2PeVCNk4dxxVbfOWWr3H7XV/nmVeeQ6eTi3QSJpsbikjbymAjbAQ1cPPX1/nMl2/iP/zmm5hMKrAx3ZUlRlXg5MljkGXsOescBoMhw1EJAaI8p7uyv53Ko0CoeNPv/AG3fO0Ojp36EV77yhdwoA9YQ105YvXEZio6MK1h7u7PUBHS5RVskkM9YXM4oBNZluaXYdpxVU3GmkggFsWYVpxcZhQuVebnMtnaHCou5bnPuJArL72YW+47RNrpU5UlqkLVOJrRhMNHj3PVBcttXT2J0abGFa2qkGTzkOQcH6GfvP4W3vLO9/OxT32elbPPRfKEKA6ItZQefN20U3A0EEURw60J2Ig47ZHu71GXBZ/4wg1cf8MNHDpyiFe/5Hk8/xkXaKwiTYBOmopBGQ2HemDfijTBUhn0tju+zpduuh2fzMFch3xxmbquCE2DkYCrxrimIUpaxxR1uhhpEBW8ybB5l2xuD6EcMp6s8aUv38D1X/wyL3vu06WZDNSkXdlcn/DRj32SYlTSO+s8JsOTbGxuQhGo0gqKGnpzkCXYuINxY6qiJs8y4iTFSYxoTOmEia+4794H+PDHPsVrvv/VmicpVVWo1QAacM7hMIyqSvNeW6R873XX8+//469z/113k591LtJZbPFbp5RFSVk68AEjEXE2z8aoIs7mWej2KcshH/rM9dz10CMcGxb83I+/kr4xSIjVaMDuGsU9444eP7XJV2+/i42JZ25plRhhcOI4N915Hw+vbXHRxfO8/X1/wns/8ik2Rg0kfUyc4gI8+OBh5pYXSPvgx+t89JOf4eUveg7XXH6uxHGfUdVomsIHPvZpbr3zXuZW9tNb3ke1vsV9h9f4wk23c/6ll/Aff/U/88H3v4/O/Dz7z7+UY6c2cJsnmd+7F3zDxsk1tK7pLi6y77xLaeqKOx88wm13/QGNCq966Qt50TPPIY0Q1xhV9UQGiAzhLyMke1o9c9bHN5OeG21B0mBCQyyObqz0IoWmJhWDNxFWlRRPpA0CeAnEgCcC4+jbBB9N8AZCWmFqJa1PQb0FmfuuCsWMRyPytI+NWkkzi6UoCpxzZAmkmkuktaoILnh1U/UVS8sq3rO6SjHYUpWIuW5PAnDhOWfxV97wg/zb3/wdJkWBdGKy+UWqyYDRcMI9DzzEySGs5GY7Ctk91d5jcSLaCPzWm67jPR/6KF+9+TbmlleZ37OfjWHBqJyQzc2hxlI3DdoU1G46R0I9USSkccJwOKZxCdncMhIlfOKLN3Jq/f/h7/z8T/Cj3/9MtAbnakJQxBhEwMaWJsADBw8SFKIoxlpD2dQ0Xsl6c5TWAYaqGENwJJ0OsUA1HmLihCzLSfOcU5tb2ChhfnGZtVNHOPjQwzNhAO3EIkmWYZMU5w3OC1WAB47W/OEfv5/fedPvk+87h3yxv70FotjSW1oiBGVzYx1jI9I0RUyEGsukrFHnWkaihaULLuPGG2/jngce4tDho/z1n/hRLliBLOmLTkba6iTr4/SFtpFxVTuoC+bmOozHA1IjYGO2hiOM7CWOY7HqIDgNTdNmECKIjcAKYeukzi8sy+ak0KVeziUXnc+Xb74LkZROrw9NwWTrBFmUsHZqnaJCu1YkyzLxdaFxZw6nAllfjg68/v4fXcd/+u//g7Vj6yxfcAmDcYEK2CgisrZtdyBg44go7pDmCcPRGOfboM/aNoh1tVAEz6/9yq9z77334v7aT/KSZ16sebcnk9FAIzzzC3Oi1VjLStH+PI888gh+OGLPU69gY9xQDEdESYROhvSXF3BNTela+crRcIsottRVRZwkBCKa0YQmcmRpRBTH1KOSIw8fJHvJNVSt3KDiG9ZOHEO6PYIq/W6XQKDMLN08YezclCNR48shkXWoq7FJQl2VjJsS05mHKAfn2HfRxRw+dpzxpKC/lEtV1Nrvd8WKalAYTErtLcyxNoH/8qY/5A/f9R7WNgYsn3cRNu9wqiwRG5N0MywRrnI0zmMQ4igFK0zGQzSL6a8eoF433H/7vfzKb/8eN916G7/1b/4B1kTY4CC40w29gTvuuof1YUE6t8xWpdgoYm7fOQw2TnL3g4foL67wvg9/nLVHjrF80aVsjiuch/mlFbYQxmWNcZ69KyuMQ4GJYvyUxJPmHfnC3cf16MlN9p53EbU3HD65yeLSCuWpdT7zpRu5/oavsnbiGNn8MkknZ1w7bJrjIiiqBuqC3tw8Nk7xQVkflXjvsXGPLO/xG7/yG9R1wwXn/SznLqMugIRGI6VVh7KG74YB/65RQU+TrnvUTLpdfc+7CTA7MbbsaoWVb/pHaJqmnTk5nRmoQB2gIKFK5qhtl2EjTBpFxWKMIbgK8RXl4BTWOBKpoR5hfIG4oj0Y32WljiRN8d5TFAUisj2fMooiAuBV8dqO6ApiREwkYiJR09YfvQJiybJcWnUWdK5veNlLXkQWR9jIomUFNkLiFLUJh4+f5Jav3UUUIVNaNuPJBMlycYoSGWyGvPltH+HXfvvN3P3QCeb3PAXiDsdPnMJ7T7+bU422qLZOtvB3mBA3WyTNFh0dkbot3Ogk6isWFhcZDIZk/QVIutxx/8P8s3/zK1x/6yHiBJmUTuM4wTuHNUbG44lGBp71rGvIY0szGWB8RWaVxARoChgPyGJp+2PFE9EQmgmJtD/35RhchQUWFuZZWzvB4uICl112KQJtD1dda900bG5taR1UkwyOnvT8w3/6L3jz2/6IbHU/SZLSVCWGgPp6Wh9tmO/E1IN1Em2o1o4grqCXWnS4AU3J/OI8WZowmFQkqwcovOV33vI2fvO3f4eJh/VBpVHWkZ1BXbJr5mP7Eaaz3sh7DEpH1OlDnOOw9BaWcaDYhBbSs2CiduA6ptXpcB4TWar1NY1EMcDK0hJpt4PWNc75bTF/BTa3BmQp0jink8lE1USQLciJMRSgv/Hmd/Lv/subGZPRecqFlL6d9WrUE4UK68bEfkIvCiShYnLiMKOtTVxZtLDscIB3nsWlFYK2StH9cy/muk98jn/9H36dew8NaEC7vTlJ81yq0VCLwQa91BKDXPO0K8gXepy4507meynGBLSeEKeWydYpxJWkJhCqMXliyCMhEU8eKeJKkECWx4RqTDXaYqGX8dxrnka5saZpaohTKzGeZ139VPTUcWyoMb5EmoIoNERaQzGEakwkDrQhwRFpQyyePIZOLMTTMlGoC44dPMhzn/d8Op0c1wTtZJmMR0NFDEEscWcOB/yn//r7/NfffQuNiTFph43BCCNKpiU9JpjxCcqTD6GjNfrWkVNRbK6Bq1hZXqSoSjZHE0KU0730qQzHjvd//HP883/z29gYkjwTNREqYIyQxAl1A7VXiiagcU6jESRdBkWDxDlqEz7+6c9x8O576Z51NsNxsT3fc2v9JHO9Lr4q2LO8xKH776ff63LhhRe2SUlQnIKNM+K8y6mtEUUTSDo9tsYlvYVlHj58lLvuvZ+ibsg73Za1XVfEscVaqLfWiaRF07qdnKquMVHb06xJzrgRkrPO463vei/veu8H8YBHyDtdKYqCJM+/a1pmhu/1pY/f5Ul/HuIMSXJM2qOWlEENQ2cZacZak/HghuORodKkS2hnmZGPGNYBjTIkTsHGYGyrbNI6prYHzkQ82Tqk7Rx3SxAjiiXI9KP9uqX+iGlJItN7lFpYWV7i4osuxLsGpnMNnYJEKZPKc3J9CwUa5xUjpGlKNRqrw0AM7/3ITfq291zHyUGFzedIunMUtWsDIFczPHWMTEtWupYDcxFnzUUsxw1pvYkZnyRtNumZml4CJ08cpdPvUVQNalPi7gJHTg74t7/6G9zz0JbOzXckjlNR38KKed62hVx+ycX8wCuv5Zx9S2wcPsho/TipeEI1xsZCHgn9LIJqwuTYIYqNk0w2T2DcBOsnUA6ZnDrGkQfuYd/qIj/302/kVa94MUFhfeOUZt2OdObmZW5xSRyGGvi3v/KfuOlrd5HNLSFxymCwRWqFeryF8SXdzOKLTXLTcP7+Zfqx56wDy3SkZnjiEZJEWZzvUA9PUTxysDUCZUPc6VM45YMf+QRvfcfH6M2nUtSBIK2TYyasv0v0QwDyVvEHiaiawKisGRY1ZeNpFDxoEIsXI346xUNthNqolYOKE5Ik2f69hw49ghGhOz9HfXKNuiqJoraSPRsdJmKIkxSVSA6fHGp/dYF3fPir/O473sfQR3QW9zIZFTQ+4KoJ4grc6CTV5jGiakDf1Oyfz7j0onPQcoilQZoJ3U5Ctb7GiYP30+n1yTp9Km9I+ivcf3iNf/n//ifWJ1AGtKqdRlFMZ2kRdTWpwEuf+0x+7PXfz74DK2wefYhw9GGkmZBFcPb+vaSRwdclvi7w1ZjhoYNUw1NM1o/jxxtQbFIee4j65BGuuOAp/MJf/1kuueg8yeb7aDHBDTf1rH0r8mNv+AGe+bxrGJ44xNaJw5imQJoJxleQWAweV4ygKTGuwhcDBiePUmyuEYpN/OgUph7SjZQ3/sxP8aIXPp9+3j7TJGoZqj5AHURNAm993+d4+3uvY1Qp4zqw/+xzmF9Y4NgjD+EGayzHDVdfeIBXveBqXvOSZ/Liay7livP3cvZKl1BscOKRB+jlbfZOFFN6sIt7ibuLvP+jn+Yt7/4kY4diWlnFpmloXEOeICoWF1oxF6IMh8UkORKnnFzf4FOf+hTZ0iJZHFGPB1BPML4mNYHBoQeJaTh8z+2sri7ycz/1Rp7x9KuoPVrXDUagCYGt4ZjVPXsp6wZjYzrdHlt3383yygp7VlcQDZSTIaEuaCYDxptrdCLlokvOp58Ko/XjHH34wfbZekeglX20aQeb9aiC4ROf/SK33r1GrxuJInS7Xarx6LuW7UTfy75ylxienu4wLfVgQBIqQtJnbv8FdHVMGiaYakjc6RN396JAzw+I6gH14CTj4RbOK7EVcjuVtJOGWhyl7VBqF2d6YPLpqLEnL0YIYhCMTJ2mzghI7SBcEZFWqH0m9uzFYGLDynLElVdczpfv/iQkltDOB8PGGeNyxMOHj7a9zsZK0KBR3pG6aDTpJHJkE/39d76Hr952F6sXXM7aQ4cx/Q79bs7q4hyXXHAul150Li983rPJEyGNDYkVNDQMtja4/757uemmG7n97gc4ulUzOniY3sWtKDpRSoPB25wv3ngb73zPB/mnv/RTCIa6mmicJoIGqkZ1/2qHf/VPf5mbvnYfN99+F1He496HD/Ou934AV1c0RczVV1/N5ZdcwoE9K8zlKUcP3s9Sv4PWJaNJQba4RJqlnLNvmedefTlzaVuzDSEwmZRalDXdhUVpgA9c90Xe/f7ryBb3YdMO480tInUsdLqsnH0OL3vJi7j6qiuwElhZWmRhfo6ymCDG8sBDj3DDV2/hptvu4Pa77sYFuOCqSzh0aoCPemCEYGIOHz7OW97xbl7z8pfquauJuDoVo6gRacWSpjvcaMCItoVKbNsCZRKUBozFxhlGWhRFFTUYMaZV8jNTJEfF0AzHZMurMtqo1OadaYagjE+uES/OE+qCJLYEIywszLfDywGxVpxa5lc73HjPFr/5e29nElJIIrYmNSQJ9WTAJefu5flPv5ynXXIe55+9n7PPOhvFsLE1plZDhXDH3ffwJ3/yEQ4+coiSmrQ7x97lRR68826ihUXyXs7J9eO874Mf5Q0/8Gpe+5LnMJ90BDdRQqAoJmRJlysvWJX//Rd/Xq99yQs5uj6mIeKOr9/DB6/7EIcOjYnjmBe/6IVcddVV7N+/n/UTR5lLILia0gtRmmFtRKQNT73gAC9/zsViq0mb3UcxGiCNDD/4yufK/nMv0lvvvJtivElRN7zrgx/jvkeOE8cdLjzvHK66/FKeceUlSLGJVgOa8VbLXk8yarUQd5ib6/PMKy7msvOWsCBVWajMtfNL1ViCjXjoeM3v/MG7ODVqOOvCyzj8yMM8+LXbufTqp/Ga73sBf/UHruWsPQvsWd1Lr2uxU9BhcwDrmyUf/sSnef+ffJyHT5zi5LFjZGc9hXI0gdrB4hzHDj7E29/7IV724udx/p6O2MYTqlKrstCoF4u1Uas+SgvhO+exxhJUueeeuxlubpBaOHXsEKt79nLttS/j8ssv4+KLLmQ02MSVY9aPH+bCs/fx4uc9g4UcqSuvWd6hVjRJM4qqZFyOWVpeYTAqqeqGpSsuYzzcxE8G4CvO3r+Hl7z4Bbzghc9nz759OIW6LFnqZhx6+BG+fPPtfPxzX+K+2+6GxT309p3FZDIBI9i0w/U33sznvnQDz7z0B7SsG/pZIs14qEmc/+VymLMesyk1dtt7TrVaJZtfBu3q6tOey+oll0Ks4MZQjdvofOxgrg8bD1Pfej1ra2uIzbBJRF0XmKBYNdQYnIlxJqMhI5isHRL9JCffOq3Q70gBmp0fCKqoiGnnXWrwBHU0LiGJ4NynnA2uIbaWxnlEDVGcUk22ePjQ0ZbmYyPKYkyn2yHtdKUWeP9HPsEXbrqNbHU/cd6FOOLqq5/Oi5/3LJ71tMt4xfP2EbdmvL07CkZboQI4i1c89yo2f+g1+tCRE7z5He/luk9+kaPrx4l6y6TdeUbDCXF3noyM9133EX7s9a/RK85dkqBKZA2jYqwmyWgqWM6tfN9zLtLnP/siEPjsrce47kMfxgdHcDX33HUXe5cWeMblF/P6l52P6JXEAYyHNIFROzyZiFatbrA11rk8keXlZRmNRpp2e6iBysN//723YLMuDsvk2AlWzzuPFz3jcl7+oufyypc9jV7Walt0bXvd4wl0Ol0scM0lS/zwK5/OyRFc95HP8fZ3vpvrb76ZbO959BaXWT9yhDhJ2XvBRdz9wMO85e3v5h//bz+hamIJocUKQjsBbsobbjVbqRsIAbERNk6IfYO1M4mzaTyndiqNHFpwdwpEiRjJFpd1NJjo4vKyPLiBXvfhD9PEc1z+9Gt44OBBrBXU1ySxZe/qCqotnGYAtbFWwEc+9QVuvvNeTD4PcUxTVTzjmqt5/atfyhVPWebaa86iC9RlIE2NGIEyLKgYGHu49pp9/M2feAlfveUIb/nDd/DHH/wIBycFS2efzahoqLxC3KG3ehZvevPbuOaKS1k4e566glSFvNOnrkqVgFyyvyfn7X+GTtpHwR99ZI4PfvCDRHGCRBFrpza49957ufqpV/GTr72MZLpHq2kwktl23ybTW+e9V5oam+REQRhsbaqzHa65ZJmnX/KCVu2qhFtvv5t7H3iYxgtrx47xYGJZ6kT8rZ/6Ic5baoUZfIDIQDm1UzJth8lpiZ5VMYJe0upqJZnUHn3n+67jjvsfoZGEw/c/zLlXXMpzrnk6r3vVy3jKcpeL9nbpJ4q1Fld7gg9ENmZPH5Z6GX//r38/z3/eNfzRdR/jzW9/NxGBzsI8k2OnSNIO1epZ3HH/w3z2+hs563UvURNUkiShaQJOURNZ0Gmft7FQlZBGqA/cd/fX8dUYNxnwtMsu4K/93M/xqlc+m37O9L4uT4sJTyOZmuaN9aHO97tkcSJbNWqMkKUJGydPYBZXEAJN0bKP1w+f4MqLz+PHfvh1/PiPvpLlHi1pLEAeg2GeGHj2xfO84DlXcfFFF/Kbv/c2HjhykmIyxo0m0Enp9+fZ2DzBTbfeTuAHKGtH1xrSNPuuFdS+NyFZ3ckwjU6VY6dixC2L0LCxMdRiWOMrC9Ei2CUwq2D3gu/B4iq4Go4f4/iRw4y2NiA0WPFYPKGp8a4haGhBsChCTYyTqJWGeZIh2W81m8p7jxGBEDCiEpl29xtgz9Jiq21pDISANQZrW23LU+sb25CsD0rdNOoQTo7QP/rghxlXnnxhiSP33MO1r3k1r3rFtZw8+jA3ffHTPPLgFqYBUwayxktPvaS+lnJrS7dOretoONZenvG0S86R//Pv/21+6W/9DLlxlKNBa8xtRKMRkwYOHj7OF758I9JOFxEbWUJT001TqSdDhhubGqpAPWqF6FPbGqU8S6nrmlOnTvHud72T//ff/Ru+ctNROgJRAKkCGUhXwU0CoVISDcQ4XF2qaiDNO5KksYwq9BOf+SK33Xk3q/sOMBkMWbnwYn7oDW/gOc+6hvf/8bt437s/SjmEOQsxyHhjzEoHST3SjArcuMaNHXt78Nd+9MX8i3/0y7zk+ddQjjapJhNwDhslRFkHb2Le9+GP8ciJgDOoN4l6ifEq2709EnzrMKcQngQPrgHnCM7hXYMDiqKhLAuKstCqKrWsKy2qUidVqaOy0iZYOTWuOTVGf/O3fodub47Xv/71nH3WAarNDSyBajJiz/ISe1dXiA0yVQHSKBE5ugZ/+M53EyU5vfkFsk6HF1/7Yq598fN44M5buP6TH+bYg0fIQRI3IvG+JdSVMB7AgkVMCQsgL7v6AL/6L3+Zv/e//CyRr/FViSrUpUMlZWH1LL70lVu47a778ICThLEzmE5fkiQRVwxVygmpV4lrkAAmNEzGE9LuHMEk3PK1O/ngW/6A33nTf+Pu+ydYIAMWDNIF3Mjjxg2uaHQyGGmcdWTcQB0iJO+LsRG+GtOMSqgUCdBLwQTfkgejmFMn1vjqpz/LW/7HH/D+93+YOrQYALXDeiR1SuJBGjA1GBBftWIC6v32tJVDx4f8j3e8h6r02M48Fz/n+bzila8msob/8G//H/7lP/u/iEUwIWCDlzg0xFqS6EQSGulYpJxUPOeKPfzSL/wUb3zDaxmdPEaKkq0uU44Lks4cG2PHB/7kE0wqqBqnxhrpdjvSIhotjySE0LbLGCGyhiQStk6dYPPEES497yz+j7/3t/mZ1z+bAznkAcJY0YnHlB5bNrhxgS9K5nspwddUtdM8QcpiQpbErOzbw8mjh+mmMZGFI7fdxF/94dfx1t/7T/ytn3sl+3vtue0qrMRgGtg6fopqY4AbVuzvw0++4dn85F95PbF4ms1TpPNzuMYRMPQXl7n73vs4crKh2+9IUTc6q83/paphyu6KpW5PYN/WlU06fULco476NGaOoH1I90D3bIjmoZwwvvlL3P2lTzFee4SFJJCFCabcpCs1ORWpVsShJtIGq75VD5oi5U/2eJ72mluljtk9YEfpX9CgGgIanFpUsySWSNoDPN/vtOJFKEZBVAhBiaKYsqy3R411+30RY6UJqrfccRd3P/AQyfIeNraGvOyH38Dll17Eu972B/zR29/CnvmM8/fNkwUvc6lKsX5Ew3hDYxpd6OWysrgoc/2uWIt4RffPp/Ljr381r3jpC4jwDNbXW4KKTTBJjk07fPnGm6gcbSikM/3hQGwCy/1cegnSiad1n2KCa5qWQGYMi8tL9ObmeOSRh/nUJz6G95BHSBQqRutbmoMkfkISCnoxstjLJY2tNE2tRVXpuA46qQPv+KM/xmMYjCd0lld44YtfwuHDh/lHf/cXqYsRr331y1ntw2TkEAdSjxisHVdTjzTVisVuJEudSCYbIxKQ5199Lr/4N36Oxbku4/WTJHN94iThkUNHibIum6OS2+++H2/BG8GL1SA7NPh2+qknsqZth2pqQlNjCGRxRDdLSYBuJ6aTZ9Lt5pJ3csk6mWSdTNI8bXv84oy9Z+2XQeEYVw1/9+//bzzlnHP53Gc/Q3dhDt9UiHquftqVLC12UdA4bgllAJ/45GdQbaXHBidP8vLvexkH9q7ypt/6Dd7/7rfzvGdczlP2zGG0JHIT6tGGau1JbJvNua2xJtUAHRVarI9YSZGf/tHX85LnP5vQ1IiYVjuPiOMnB2S9RW669U4GBZrmidQkjCuvIQTt5glR5FTKTU1DJT0DkRHwgWFRM3HQmV/C7D+Le+65l49/9E+IgWJU40uncxaZj71EzYjMeJmf60lZezTOKUmYNEqWd2V1eVEWe4lQDogCEgHFaERT1+R5l/7CEtmeffR7C7znPe/j8KEtBHCTMaYpiJoxSVOKlG2dU13QLBLpd3MEVWsjqT16w023MigastX9+Mpz1rnn87Xb7+B9730PDz1wH//yn/3/iY1gsK32uhVJrGKpVJuB+npDbRhRVa1D+eW/+79w/ll72Dj8EJmAliWVFyTtcee9DzKpWq3sunEqCNa2A8zFtn23IgJxQmwtaRIRG2Uuj/mR172a1137VFLg6EPHmDPI3q7IcuJk3lYynwRJtSQKFd0kktiITCbjtuQj7fQWV5V0uxnFeIvEKD/0kz/GP/vHf5O9i21Q4ctAVFckboKpxixEjVy4d072zMWykARJFOkAT7/8IlYX+pgsJY4sGMNoPMHYmKPH1zh6fA1jWgSmcf67lvCY71lnqa3TmDlNM4VpRY0oVsVmojbD2S6FdBlLnzruS5UuSN1EjO66lfX7b0JPPcCKHbIvLZn3m3TrdeZ0yGLqWIxrcsZkfkTiRiShJNWy1boiPKnX3zoPnY5XCiLbsu6z8UitgENoVf+JLUhL3SExEAmoc6ifau/WDhvF+KAEwNiobeewlji28tkvfomtoqQzvwS142u33cr7/vhd3H/LV3jdq7+Pn/2JN7CQI77Y1GawpvMr80SJ4IsRk+GWVlWN8zCu0PWNMZPRQJe6kfzMj/8oq0sLMB6DMUiU0OktIDbl6/fcz9rJIQCuqUmSmLouNEtjmmKk5WhL+1kkqWnFDYIG6sbT6fY5eegwnW6PNE154IH70dBCsHP9XKJQ4cYb2rUOG0rGg1PaVBONrSG2kVgTkSVGBsMxBx8+TJJ12BoM6fR6PPjQQ3z4D9/KJc94Oj/70z/F6pLFebAEtCnZu2dZlpbnJU6NUI8ZnTymvhxpNwZXOY1Brn3hlTzrGU8HaaHm4FtWalCD2oTb774PL7Qf0wBQp5OxjAashhYdcXWrVmOULDLEovimpHYQGySy7XSVyMhUNUmmBf9WZWVjgsZ5xPe96vu5/8GH+cM/fBvl1iadNEFdzeJcj5df+1LmOlAWijVTlrlDv/iFz3P40MN0OznzS4t8+Yuf40Pvfw/D9RP8+A+/jpc895nMpUYIlaaJIY1M239pkU6KRL6g14ukmxuJmjEJcNm5PV75spcyPHYUVZ1Oc0lpakfameOOu+5te5CBuBtTekPduFZdZ7RJKDaxvlDbDskkX1om6y9ClFMFQ96bY3NrQFNXGKApxy3TWh2ZabSfCEa9jsdjdRiNux0JccrmxOmpraFOJhN8MdJImylyMzuQFueVqvaUpWPt1AZHj53AtxNN6OaJpGlMboXMKoudVPJIRHwjVgKREZxzREnbY/2Zz3+JrWNr2LQLac4NN97MDZ/5DK5ueMPrf4ArL1omz5A0NRLHFmNb1nsUGdIY0lhZ7uXSFJv4AOcswRt/+AfbAKuc0O/1MVGKSTsMxyXHTqyRZpl476mbeqqQoS0pLAR0eq1NXRKaGovn0gvO5XWvehkxSKgDK/2YhAYpN3Ry8pCaaqD4iWbiCOWIyXBTjUC/1wqnt0hQyWi4xVy3Q12MueySC/jZn34jDz+wxsaJGmk885mRXiaShgluuEa5cVjD+KRW60fV+rHGocFVcPmFZ3POgX1084TR8aPEcYyva2rnQAyn1jdah2aj74pgwbdRw5THJ6k+pm9s51W7e8mEoIKX3aMpBZkK6M9mM4TpzMrdk9uMtKSXqRKMem2dxpQ5KlY8VhqHBiwmmo21LFvx7Gqk5dG7ue+LH2aPO8a+3NE1jlAHXIAm6tFIwmK/T5B1TLlJaCrwDkNr2DD2CUco32Bq4s4kPJHZ5Lvp93amsYRpVcqwe/KbsluTx8aJqHrqqlYxQqyKdzXGRoSmwmgguHbUlAbFOUcaWTBCo+2DH4xGGsUx1iby1VtupR5NSFSg1yeo48gjB1ncv8rrX/sqOikMBwNdnO9JsX5CdTAgTlJs1sUGI7WKeqdEVljod8lNJZPJWJ9zzWWsLPQ4OnCksaUajNioApkKJwcj1scl+/f0RbSh043k6NEjum/vXpE0YePkhkrukciSp3Gr6zrcIlZlbv8+vAbGkwnGRmQxbG1VmrqC3vycIIHgKnUukOYZYmMZjgpt1NCbn5cG9PNfuoGiaiHTftpnOBhx2+e/QLZnlb2LfV7zfc+ia2A8ciz1EimGQ/UNUoy2lODpLS0LCmVRaRKn4jVQTWrNOwlPv+pKPvfVO5hsbkEUc9Y553L4wfsRV3D46NE2KJrV5zW0leFdfVQaPFYDxhqsxHiF9VHJ/YfWGE0qJFRq0OlpaWv9IWgrk4fljrsf5PipLT788U9zajDh8NGTSJyytLLA1tphUnHsW1ri2Vc/lQgYTibM5V2axlO5hkeOHsekOePJhLwfs3VqrWWlrq7wqpddy2Ivk3K4rqYakvf72Chl4hwNsUYGunN9oRhqXdUsLi5IVdRokvCMqy7lossv4r7jw1Z5xhrmllfYOHQvDx2OqUOrUes9WIQ4joXgFFHiXheSXAYNqsFT1zV+OGq7kyMhimPGxYQoas3awlxfskhwVamTwSa9uT42TWUynKiJZJtR2O1mpCYT6gnONXQ7OUVoa//GWGyU4E0MJiGNUygF7zYJwbc1ZdcoamU8HKASadrpSZJkFMVEa1ppOufb1hancPe995GsrDLe3KS7Zz/jUyeh1yc2NS9+2cs5NgI39oqrEa2JIyWJAqINPlSEEBhXp7Q3v8KRR46T9Fa47PKr6PV6DDc3yRZiJMlxRcHIl9z/4EM8+5L9iI1xzquJW+2wLBIqX7fZsDVUZUHVlEQ2cPVTL+fSc5Zla2useSSsLi1IOdjQphjR37MK3lMNBqSdHr2lJanLRsui1LzXn43P1RCUPXv3ceTwUXqLK7z8Fa/ii1/8Eu9+65v52HveRjezIsEz3lrXyHj6y4uAUG1tki4tQdFQl6Wmecz+RdCmJNQlSb/XqoNZC6L05xcYTyZUDk2tlVgEF/6nzsPczum+BTC5M6jTqJ7mLKFBpsJfaMCotProM5FYPCLNdFBpOxm51TO1BBFCnBCaSpOpRFyr4ejApEo2J2JiqZV27plONNcNoFJ58EZuvO4PODvaZNmO6dsaV9esTZRxsofOec9h3/mXQ2q555MfYA+GXsfhKkVtRJAcQlvabnUXZ6K2ut1bKubbScx35k/sGnuqut0yIsg06/ACs/6sGTznTaSiYUr6YTocbJp3ilWvSlM35N05McYwnBTa7/WkqGo9deIIkQWvAXUNSa+LaoMxwvzCInZKO46TTJIk4f7DJ3QwGJLMLzApSogs48mYJI9ZWepy6SXnE1sgsQy2tnRucUXKxutEIjwWtUanwQ0SAla9DAdbOre8TwzouQdWuf2BI1SjUyzuO8DGkcOEOOFUMeahtS0uvXBVXQWx1uxdXsJXpRqbStrpE6YKFt6ViC/pdmK8VWpXUTQN2dw8Ns3xQH8uFb/llMarE0cQA5Gl8oKGgKRdIokZNaiN4cSpAVuDCXFnkTpM68F5B6ohL3rGZeShRlwsvdRQVY0meVcq79BsjizNZFLVhBDURrkEhBCCJtaKB73ogguoypKk2wOxHDt+gvnFBcYnD0Oo8U3LU0vFS41rtZesoDal9tJm2+oQY2gwOLEYSfhb/+jftijDDsGn1R7Xae9uaD+C9+A8RJa8m9NbXsZNhtRbJ1hKhPHGSf7Z//6vObCU4WtI44SyUF1Y6MnHr79Tjw0LfNbFphmjyRirATcuOP/KizjvrHNwHo3TeZEo1SYo3kQS4kiDQK1gmkAa50Q2ZTgaad5flNQi+1fmdamXEB+tcM2EKM0ZbI3ozM3hEI6tD9mz2EcEIgcafBtr2gRcIIjTOE0FUKMB72ts1m1bE0Ig73QYj8ctB0CESeXUSCTp/ApVCFA2JGkmQT20EpEIKuoDRgQTZTRe2lHWAZIkxZuYKph2wL2viK0lsTG+LkkEQtTunSjvQ9KTyqn6cUM370pVVZpkaTsSDbjvwSMMhwVp1I7sm2ydQmKDlQis5f/+ld9goZdTFxUynWYz0xyeoU6gRHFKUIMLhtpB0QTi7gK9JFCpwzcFvcU5Rvc/2IqMKBrZRGLTDieMtcG6CQmKmgRMTMg7kMS4epM3vO61uLLW1fmulEVJVTXEeV/EJuobi6pB8kVqFaRWVCJpYxsHSYJBsDahdIDGXHLlMzh2asR1f/xO9s0v4YJBDJRlQ5J2iCJDXTpskkhI5tVVikQ5XmOcb4fDH9i7zE133ovtWlwlbZbZNAyGI3r9uamypsXXlTKLiP5nZZgzBRh5nJZIeRSTVU7LR2fzImemfmcKBmoe7WzbMQOYaY5ppnqmgtc27g6zMHA270otaKAqC+3N5+KqkrjZBNlkcsOneejmT3LpfEPqPM1wTGEaku4Ccb6IpGeRn3cN5hkvxN19G4Xt4/06RhsibSN6pzLlgcqfOdC6k0DIo37/zlT2WQgSTp9Sv0sscJqHGyNZ3iGo0jReA4a19U1dWVqQ8WSiTeNI+hFx1s5b8s5RuAnzc30M02zEe1VEBsMxw9G4JQFMp8fXzmFDYM+eVfq9LhYkCJp3O4yKQiXOcVOHiUjbDkHAaoMlaK/bRad6NgtzfbQpibswGm1BGrd/XyzeRHhAxIJKO25sOvB7mlNPd1A7kqKd2dkOLg7SjhutfWjvWdhmis5yt/Yeyg7TOEx3p1fY2BxQN356PyCyCU3jsSIc2LNEP4ulbhq8D+0QhHbgtpoooWy8htBqrU4pqxgRMaoEkDxNVVo6M3Ec4ZqZbJxSlZPpTvfTj7ALP2jfZzEcQNeSZBlmCumVLoC2g6jVh+ncN7Mz/21WYTGKLPTRpoLxgGI4Jk2FhW6KTgpGp07wD/7eL/CMKy4li1pySjBmqh0iOK+sDUaoTbBJSpIk+MmY4BwL/Tn27WlHm7Wia7GohPZZ7Ja1NJbatVJlSZoRxRETB/1eRlvT8xjZns2Cik5ne+6INe6SbWyvUw3TphvMVHc2mHZ6karf7s3ZDiZ0Z2Lt9LmrTIfZGcJpwNgs8A9iWqqE7gr/MdMWn/Z+B4SgOhU2b9EADVPhiOk1RDZGFLxX6lrVSUswmJSOSVlSlZ6klxEiS9U0uOAxxrC2NeLQ0eNIlLZB+w5vYdfXANMpPyba3gO6XbQBrQpUDL2leaIoom4gS9oJRLVH29alBmMTRAIebSFmsfTn59mzskxqRaQdWK+RTUTF4LeZEhCm4ynM9lndPVeqHVJdNx46PaomcP/BQ4yKimTP0s5IQZ09aSMBqxDjZr0BYiVMUzGBaSkqtM9Vdk8j3rGbO0jc/1RIVhH1U0hQviVoOxtWJrsKjzsXMXWCyPRQyfbhnop56bbzlZ2szBBawyYR3hixCERK48EHQ5pZqUdDzXMFVzC8+fMc/OqnScZHibuWqmpIsgXGdcmJkSXad4ALn34tXPpswGJDTerGdPyASEvyECh8B6cNs8rSn0Ul8vFqszv3bHqHphvBbEeTbBuS2b0122KBMg0tLCFAVdUqxtLrdWRrZLQM6Fduvq2d1hLFbV0jtHUU0cC5Zx1gx2AErMBwOGRrMMRGC1P31DbTexUWllbp9rNplufodDMpRkNNopZQPpt00kbDun2NNkqkqBv1UUyn12vZonFMORmTdDqEotp1Dzg9G5edId07RK/W1AVtBR1a4zXN1kPYrjhP6TM6G0w+1VNsG3RUtxV1gsLW1mbrqkTwQVsptabES8u+CwhOVVUVa4xYUfBOjAh4r20UbcWgaAgE7zXYSIKicZy0guDek1k7/brVWHXuW8/qW1hZoSAheNeKzGvbPxxHMVEUUUyK9j5JG0DM5KZ1Glro2hGwQtrvMJd2GK8fZe3ICS48aw+veMFr+Pmf+WlWFyMZj5xmSaSgaFBCMEyKgqZxSNrDBYjjmBDFeIR+f45O3h6RFnsL7bOfOh8NomggEiWEBjGWaDpbdlxU2ummSJRMRTjMtuz8dsio4bSTo9uBwFSkY9ZeNVVIMqZFgmZZtph24LOZ7gUlTIsfrTjm7LeFb1Ay2eGoy7bz2/Vuds7srpeH4Jl6UESn71YdolHLcg6OgEW9wTlHXTdEcdvr3c5SCOAaaq/ERjFxiiQ9lOg0XGrna2gaN3WU0xKSmG1bizbsXe1z/IE72L+YsW9lkU6C+KAMhiPtz8+LitUmBIIRjE6tsHOYyLBvdZX9+1awNlBV1Taydpp627dYIQSstdT1hE63z2Qy4diRo9RlSZqm/Hld0TcGZHeFXzu2+hv2gMjjOAvFSDsxqt3obQ3SbEuCPb4zbg2bUZHIGtWQUE0bD4OfESM83SSIFgMYDtGHbuXwbZ8nLU5woG8pRgOI5yhNRh138dkSqxc9G654PiTLMFhv1Te0JA0TkILIQxTVGJrptO4n2hkj24f68e7MDG7ZBlpnw4Q17Nyd7Yhyhy273VbSNCAWI61JCEC3l8nBw6f0jnsewCQZTsGFQKg9kSj9fs5F55+DBohERaYFMOccznmibNqlJhE2zvEmbgkmKRQNKr5FDtLItvBry0wX1Z2Gn9Y9GcrGaa0xNqUlbpgdIQhjZFdE+o0Ooers+ndwi5naUURoUwtkCuW31e9pBVwDIjPcYja1QFFRCaoqIiQGggaMtS1bMAg6bXSsFepg2haH0Dqp2BrwDu9qRSCxlmkbLEE9LoTtDE0BH0JryKcsxNn80zRNHrMnHm8NBgOCJGCEJE3IkgQ0UBZjJpsF/f4cGlxrQwM7jlIVD6ycs4/hYBNXDhmNSurhOmftWeJHXv9a/vpPv5E9i5F4h07GQ7JonsgKkbWiAeq6JstyGrHURYmVHCM7QW9ZQ9wCArNQeBrzayv0rQGLU2sEUaXxDjuVczQGBuNiW+loW+VIp4GjOuy2QxMCIkFEjbT6x7MQMoSdjPJ0BMdibDxtSfOoep06zOnYZdl2w98oGdjNJTjtNboroDdtfXMGi+tUWF00ICEIoVajYCVgrYiKUW9B7DRLVajKCkmFtNNFfYSvS/LM0p9b4Pj6+JuG7Hmebxe/VNqh4GGKaFiUU0cfJhbHtS94NpdecG5LgmoadS60obKJaDztg5yNl/YNxlgO7FmhmyLBhZnjk1kr2454yjd3ns454jhuPxvDaDTi1IkTraC/yF8shzndftujnx6Nyequ2H9nFJfsEuZBg5i2vrILfApi2taC1tLNGiRakyi6a6uC9w02SsRHViuPNqE1iFkEuSBMTqrEBZObPsuDX/04i7LFXO7R4RrdtMconWNtbOgt7eWCZ70ULnseRIv4OsZ2FlrijLpWJzJUGMw0KnR/Jm0luo1OzXIa3R7htFOXCG1ULLtrFdMIe9tZtqQno2E765rdeBNHEqUdJk3Q4xsTXVzs8NXb72ZQehpSnAvYKCbUBVUx4tzlFc47ey+JAQmOWRNBlmWkWU4ZWhUCVBCbgklZW9+icZALxFFKM55omsSod6goRlXb52pEp7ZIRagbr7aTEIATJzewnS7eB2ya4Rv3uOZqN6gjj3Gm7d5pp6lEtJXvCLFxC00xDbinGpSt/M1OoDdznkYUMx2r28lzxAjOexxxm6JYS/CWzaKmBA0mIRDavtfgiMQTTR0FGCUEgldUBWNjiZIIP83a47glsYSplI/3HjHfnsHodDrUJt02ZHU5wagnNUqnmyC+nAazYcqwle1dqwJrB+8GFF+O6ecx33ftC3jjj7yelzzvmSz12oHDRj2dLCaJjTjnSZLWJ3TyDMG08LwxOB8QFwhiKOqaykEvOt1ViXqdoZuiXtXXRHEEPlDXNVFQur2UtRLWt0YEiVoJSmN2nrd6rLrp/mcXGW767GVXkK1KCL4V2tbWOIi1qI/Q6X4wBJ1ywpEWjt2Ganedz8dxlq18xOmpQNhN2WuxsencUZkxlFUxwbVOOrQBbRKBiQQf2pKGGIOJEozGxFGGE0vTNNtzbgfrpxgcegT6S23wqrv+pu5Ank6ngeAuWF5My3y3WlNtHONHX/9KfukX/gbLXZHB5pb2ul2Zm1+clroiHFNCkyqWdmyg+MDSQjt0wDmHSNtaFELAe6/GmG/L23nvsVPn6JyjKAoIgU6ns637/RfKYerjJpQ7NYJZ5K7bKuq7NrPoVJN/mnPIrH40daCyC2LZNZZEtBUoMCgheBW1omJblNC2wVAmiAmlUq/h7r2BtTs+SzJ4mDR17QQBI0wcHGsg2XMRZ13xdLjgGZCs4JqESiK6scWrpcFSS0RiEhqBZkq6QZ+osxSVqUqPPB5QO+s5nGaTRk9H4h+/ujntEZ1mMSZOKOtKawJptyeZibUBPvOlGzm8tkG8fAGVKnkS43xBMx7wlP2XcWB1gRjE+VrFCkEDS0vLLC8tceLYBHrtxHKnYKKMk+tD7j844jkX9UhtR6rNocZRMu0T9W19lHYMW1AjbWRuVOIYa+HIFhw+eow061CpEkWWqmjJBqcHJS1vVGUG0e+qb52Ge9hp0GXbrAqD2zX7Q7czAZkZyu3N3O6tIILRpoG9e1ZRDVRNDXFC5RzECVDxyLGTjJtWecQ7g68KTXCkAiY2UNXb9SwfDGITbJIgtjWtDz/ySAtleiWENpMNrsaHZjtS/2ZrPB4juSVLIoJXmnICrqKTRKRZwnhr8/T6lhisMbOogZ7A+eefy9OuvIxrnnYlz3vm07n8/CUikNGw1sRAnidClIN6XFOpkVRAWF5abCHHqiabnye4Bq8KYlg7tcHmEBZypr2+cprICFPBteAaiO20Qb696yLw0KERg0k11Wue2YOps9GABDf9ztS0tOGlIKbtShYzdVLt33PetS51eu2Nb6dd6K665OlnSk/jaDw+k73t+j6tCLLN7J9Cos7jprVzbW2aSDt7EAltTzcWrANVj/eqaDtsvD/XZzSoSdOUpmrQyZj+yiJXXnYVi72M8dY6oWm2ST6zMXyiO9fhppNxZgHFDJoVY4lwvOQ5P8KLn/00nnrhXokAdQ2qARMhE0WdCioRNopxXonMNFb27R7zoR1QHsexWGtpmkZhOhwifHstdzNY1nuPNg0mTUkS823t/z9nDrOFU71sbzjlUdtMZwZu5vi2t2UrDCXid46SyrYB09nnFuLRbRrq9KsZBNkSz3zL9sOSxpAbJCrXlcEjcPArPHzDh0knh9k/B6OtAVVkyfqLbIws0Z4LOffqa0kvvhw0YzJ0SHdOojgilJVWJmdi+wzCEvO2YBDBxPZwEk8d+hODDVTa6Z2nixGwXT88zdjNCtkzgQJm5AczJcBMD6ueHrsEFSZVTdRte/o+8slb+dKNtxLlfS64+BLuPXgI15RY8SSZ4XnPfBr7lyJC49oMM4qpqpp9+/ZyYN8BvvbwncRGaEIAWn3M9c0tPvrJz/LMi15LE2gzT30UfN4GT1OmcysQr5HggOu/ciuHjp4Ak2PE0jjXRp5OdznF3fUq2YZQjbYZ+KNDhxahaLeuemVS1pQ1NBZiEayJ2vewu9K0a38Z2uk/F15wHmkcMw5+m3FH1gcfccPNt/PI8Qnnn90hjiBUU2azmbGmQ4uShGk9zUSCCGWDbjXwtdvvoGmaKZXfkSQJQWtC8+0FYyJCp5Nz7lMOcPH553LO/lV6SYQrhlTjAQu9btt3q+1VtvU828KEIlx06SUsLMxz/rn7WOpO24gGNYlFl/qJlJNSLYoLDt+qRdHUpYoY9u/bw/69K6zff5Q4sozLgiiKsFmHe+9/gBtvuZVzXv10vKAydRN2hg7Npr1Pu8h9gCTLW+5BBF+5+VYG4wLogrG7iW3bQeHp1MBWOjmoYdaNDJDEMTvhWZvxeRVC4xlOyt254C4+QRvkPx6kqLukUnZkOHfTfjxBd0R/x0XJuHTUCoolMRZkimyITHHyAOoJvtHgDbGJZGlxQc8+cIAHj98JwUKU8P9R999Rll33fSf6+e29T7qpQucANHJgAhgBRlGkaIqkqCzZki15LEuW43Maz3ueNeOZN5pZXu/NrHn2jD1PDrKX/SyPlU1Jli2aoiRmEiAAkggEERqpc3d11a0bTth7/94f+1R1NQJpAiJnptaqhYVKfe85+/ziN5jBgPFoxIlrruV73v9e7n7NiHaakKy7cWJPd4nCYFD2coZ9iaJXCkYB1sfgQJpFo1ECaytjWTadBs1xRbKVxaYJTWhrxFkyawlti9GAMUgaFslOd0lRFJJlGbPZTLMs+7oB0jlHXddYm0QGVHuZP/9/3e7yJRNm2lWYPZuBPvL34Im9ddsuf3C3N5S+2txDpNjDtUSejwiVvdi6NApGsUboYlD1DcZYCuckCw1MT8HZR/jqJ3+Tw24bF7eIi8D6vnWmrfDcDOLq9bzqHd8DB26CchUkxzRC00U1QJaVsjRDnbp1LklNaxrm0bOwK4gkhwj9o5izi+zuf3dRx/o8PKzqHthxjwdNA2MCUTVNq9I4SaTfexpaH6lGq9K6oAH0wUdO8ff/t3/MyefO8ua3vpsDJ27j6VNnmG9cYpQrB1ZHvOX1r00dxnRTx4XBOCfaRIYDZN/6mhI8hRU6IhiHNY7FouYPPvVZ/urPfJCmQVfKkaBt38bp7mi9x8gSxKmXpOGZAffc/2UubU7JJgWmdHRNw6AqCN3VJ+DqXkBeAJ2S58OopGepBmXZehYt1Dkq4rAmEtT1Hb5eRfHZebWlNXLt8aM6KHOaVsjy9ICLS53rPQ98hWfPXuLo0QGFAfISiYKPDdI0ZP0oOJlGWzAZncJ2DZfngcefeJKmrnFVAicVZUkIDvHs8gS/3kdRFMzOn+ehrctMqox33fUGvutdt3KgZFfP98Ww3HvgKcSE48A36Rurg1w0epazuQpK6KBrG82yXMpBJW3bAcLhg5XeeOIaHnryNKFZEpcLyrU1bG658LWH+PTn7+F7339Hf1ydpl4s9oW1iILarEz2dCguH8jCo5s1fPnhr1IvahiOd7EMV4qvNHW54tOqexDOKv0OUwEya3CiBE38aekB+XSBed0RQINYibJjn7bDCt8p3PUlAD/KLrh/t4eLPa4hsAMvW9QtizZQB1TUUogjGhUjDoyXqOnhjqQJgyTWKfvWCo4fPUzxlUdZdg1FUWKd47lHH+WXnn6CgYM33vZ9HJlAoZlchWXQva/UJ46BJoRD6jB3Bwxc2pjrgfUhXezQ2OGKEahiXZrGxB6Zbq2DmP6us6n70xjSHrkfv8aYxv475zaEVGB+o4TZNA3GOEyW0YW06a6bPon+X/TDvFTC7FSULKfDaBNUcXmCigdVxPbQasHmeX9BQK3BFiI+Qb/wba1Ej28bjEDmLE3TwGDwAoDHVWa6Ck1dY4FBJjI0HQVLZX5Gtx79PA9+7FdY6c6zamaMXIdoYNrCmTqjW7uZa9/yQTj2GigPQGuhiVhjJDeIxEDbKU2+RnXtnVwa3sT8wJ3ItW8h7LuZYv0alnXoF+i6Zy37vJf7DQCyiQ8XNcaoaQ9gcLbvv0MgzxzL5RKXJfUdm+VkRcWy6XoeJgSTEUyh3hR4W0pnCulMSWcKia6SRRDNSsfXnt3ic198gNe94c385E/9NK953R18/Pc+RrecUeYGv9zmg+97N99x1y3MpgtdHY8kz3NC26m1js6jP/ajP8LaqMJ2S2jnsHGR9bVVsmrA/V9+iH/4T34LzYHcMfeimlXSBqg7JZpMostZBHQewFvIc/jYZx7jDz71WVw5IGJptqaMJhNi8FihB/rH3Tufdh5GQlTIcmmahjx3tB165NBBxoMKiYEic+BbqsEQQuSpZ5/j3i89gc1hEYXOlrIIosHlRFukvSmG+WKpGpXMGVkuVV93+xFuvO4acgvtcg4ayDMDyyWxjfzDf/zPePDRS3QAubA5b9CslGy4IstOoRzLvI24aiSNGsVBNYZ/8I/+KSefeprJygreewaDAdba3rfVJ1RvhK6nmlhrJcusmD57GGNovWdy+Ag0DZ/99Gf4b//Of8Uv/KNfxpK6Ct8lanJsQPd8xgZCk76nLbioFERc9OA7TAxkzkjmjKjGJAyA9mjIiGokdPCdb38rlYV6e5PBqMJ3DZc3NhgcO86/++jH+KXf+FQaORZWzm5MdRlQyQey6FRtOZJ5J5hqIt4UTJet5gX8/ic+z6c+/VmkKFNkD2G3Y99BY5ZFnnjCIe5OW3YALTsOQl2AA/tWqTKTXFcs+HpJURSY9X189p77ePrsAslLbDVga9lpJ5kGyXRWdxqNQ42jC6pZnhDgTdOo7fVU0UjmkBgTJWo8KJHYYtVDW2OdY7S6zm/9h48hDspRKacvTlVdSaeCzStsURFbjy0rqZsG56wIsDKAu9/0ejICdDXDwhHaJWZQoiHw27/923zkNz5BBmJCQ6znakKDtkudb13SxXRDxdfazqfaLWcqviGXiFOP8UnP1wGFExbzpY5HA4k+LSzyPNstGfKswPvAdLrNYDjGd56uadEYKbK0MNkdp6pSlqW0bctyuaQsy2/YTYQQGI1GeO+TZ/FikaY4/d+70h9cKWhUtX82IsYYUU2j9ixjB7REjJEsyzDGpKlH/xq99xiTErUx5tucMKXnUfVgG6zrYdY7QB/tD3mti/lMm6bREDzeR7oO7dqG3AilE6rciUtPwJWOyvurNgj6gowkFMOxdG2LhlazwgjbFzj1pc9y+mv3M5IlK0Vk++KZ9Pv5kFNTT3HkNm57z49Q3vhmop3QmEq85BLEJkkEDRiNEsVw5Ibb5fa3fYDXf+AnuPm9P8ZN7/lRXv/eH+bWN72T6vC1RIy8suZyZ0SWbnzXdbRt1BDYlaZyLu0QgqaKtQ2K2nRYcaAZaCZo7oh5QSwGhGIosRjgs1LnAVrg2mtW+O4Pf4jX3vlGHnviKX7+H/5Dtp57ioNrI8JyypH9K/zYD38/s1lgbTKQ7e2pgtC0nhCV3CFHD+7n7te/ju0LpzmwNmL92CFOP/ZVjLVk5YB/8i//Nf/q136fBjSWFTUFVCuixVAWQbQTo+XQUQygFXjo5Iz//Vd+nUe+9gQ+QDkcMjxwgMV8QT2dEnyXPDtjGrKpJiH4qOCynOX2TEeTiQiwmC+YjEpuOHEN7WxKt1xADPiuhfGY+bLlU5//IqenUIxLGmPVDHPIoRH08qLTIFZX19ekrAqW87k6k6rqP/MTP067mNItplSDnObSeVaOHaVYXeOz9z7A//ZP/jn3PbqBAiv7VohZweVFUDNYk2gcrSk5N63VlLCI6C/+6if417/8a2RFmarwGJlevsx0OqWqKsbjcf+ws1tphxDU+4iPaAiBGBUxlmXdYKuKyWRC1zR88d4v8NyZmtKAU7AKVgNOvbzgM3qcelz0YtXvSmLsIb/r1ZWfXtVvvf3Nd3Li0Do5HdouWc5nXH/jDZgsY3O25H/+hz/Pr/37z9OAHjh6kHw4kAvbjW7MPZ1AbSo2lqohKylHhdz/yGl+8Zd+laefPUU1GCB5lqQSAWMt1iR6UBdCCtaie3b2V/DU2ndZB9dXWZsMWBtV4FvGkxGLxZxqMOTi5ja/9dE/4NTlVjvAVBM6sbgyk3I8IWC18ao+Kj5GjLHkmRM0EoNHY2C6NdfSIrfceB2L6WUyiQzKDJvnqMJstuSzX3yAj3/+SRrQ9cNrkMO0jtoA3uay8AkMNllbE2OE+azV2KVre3B1yP7VId1ym2brMvtWVzl48CDnnjvFL/3Kr/HFB5/Ui9Olaj6QeavaqGW8fkhGawdl4YVysi6umkhLpssguujQi9sLfezps/rgo0/rZDKQ0bCSc6fPaNnTOLq20Rh3xrqKM4Y8y7A2dZpZlmOt+6boI18vYe50mkVRkJXpediLGL/q9PVj9eclT+26Du97lv4OhShGvPe7ne+V32F3fPxt32FaZ2i6NBG3NsGmY+g0IRDRsixECFiXic1ylk2nKorLkMpUSHNZrUkCHRB25ecyaxKK8QVDpKuF9cQ4QoQsalpU+SX19CLzzQvYdka+UrJwJduxpMlWcQePc+D2t8ENbwK7LnVre+nx2E8pggqqBiMRw7xD8/VjkpujEFsldqnaDZFm4ZGsfEVA2ZQwRUxfk8SYxNJFDMZafIhEA0EFcQW5M9hCeObMBfYfOMCgtM9Dy6peAcEIs0XNM6fO8OjjT3Hflx/invu/zPlLlzF5yXAypsgzYj2l2zrPT/6ln+SNrzpCbJSmbakGFa2PCdavohbk8P4BP/7D38tnPvMZuukFaskZ719FQ6Br4OJ0yd/9+z/PQ488yn/2Yz/ELdce0JXKCpklhjTmAXjuInztiWf5p7/wC3z8E59i5cBRbDVh4/J2KrxCYP3gQZYbZ3b3tmnCKvguYhEtMidN57XKCkJIo6i1Idx6wwk+/vFPMVg/xBJDN9smrwracxf4V7/ya6xNKn70w+/n4HrObAvGI7TKocgzMkgd8XymRoTMiixb9Lvf+2buuvO1fOr+hxnlhuXmFostw3AwZLqc87E//AyXLm3wAx94H+9/zzs5cdBpNh7QgS4CFCsVDnj02Zp/8Yv/hl/+tX/LYGUfsyD9DjMBMawxGKO0dcNiscCYvrqmDyAxqvYBQYwBiXRdx6CqsHjaGHnm6ZNsXd7AHjnaV7s+Yc+fv4+TvTyLvSIjunemLVehk/ego4TIzcdzfurHfpD/+9/5f3LomhsoCuHkySeYrKxAVvDU157k7/38L/DwI1/lg+97D2967TU6WCmpVkq2ApoNUzFwcVP5jx/7Pf0n//xfct+XHmHl2ptpY8Rm4NsOYhJStyaBeeLui4+YZHx29YqjX/dce2zCLTdcx8c+9QWy8X7EZGjT4KsIruAf/MK/whrhgx/8gE7GkBnoAkqEYY5YyZRg8SGqQZNTi+/UipAZK4MiUwNcd/wIgzzt5Jt6TlgsMcMBa4eO8szZS/zWxz6By0tuue4oqyO0FcPIoeIyybNVWdRLddGL90Ez61DgpqMFf+IHPsQ//pf/Bt/BysqYjYvnGY1GFOMV7nvwUX7yL/3n/PW/9LP8qR99v8pwwKKF6RKtKrDDIU9vRl1fTUid+x88xa/++r/lM5/9HN4Hjhzax1/4z35cP/Rdb5XBeEJeVTLbuqw2q8gz5FKLEnxqCWKgaxt82/Z0Trt7D17Jx05S897jsrjbPe4kuL2Jcu89Fklnod8B9s/GlQmUEXN1kt2l+KTf0ai7X/+2Chc4i7SdqnMGZ0RCu1TtGjJryAXCcqo2RjJHmpe0S3xQTKwweLWxSbOjvFLUo75B1JM5s/ehfZHtS7psXd3h8qQIQttCWXHjrbdzvrvIuUc3Ob+sqVaOcXnWkA2OcPO7vheO38liLoTSqIhB0J6kYa5Iv/RJx4eIy3LqCG0T+jFFqjLr0GiRvRi9+ZtLmDuHJAknO5HcYdsELS+rAU1nWbY+URKM4+yFi/zTf/GLWPXM5ttXxH2et5tChMWyZro9o246MAZjHS4vwRii7zA+cPniRX7kB76HP/mjP0AMMCxEZltzXZuMZT6ba1YOxKtlWaOlgw+/97X85jvezEd+9/c4cP2tbC6XtF2gGo4ohkMuXbzA//5bH+W+rzzMLSeOcNtN1+n1J67BZjmLNnLq/GU+fc8DfOHeLxJ8i0Yhr0Y0CuQ51XDMcj6jXi6oygLifHdr6ZyRrk1s1BCVcjCirRuiWCbjoSjoTSeOUw0KSqNkRc7lZsZouM7y4GHmzz7JP/iF/x///nc/yrgqOXzkGjJjuPm647z9zXfwljuu10yh855966uybFoKl5NZ+Nk/8xN87YmfY3PjPOPRmEWzYFrD2oFDtMt5AgA9e4o/+NRnuem6a1ibjLnh+utomoazFy5y3wNf5quPPcmpM+eZzZccPr6frIvUTUNRFAyGI+rlkraZEesmAYBi7ytqDNZaUWsRi1prcc4RtOsLCctyPiPLMgZlxXg4TPsnVYzqjqDk1ajPb1joXa0TrXL1vMcQUG/48e9/D7/x67/KE6fOk1cTmM2QtXWq8SqHDx/imXNn+YVf/FV+9/c+we233MLtt93G8WPXUA6HzOuG+++/j4e//ABnzpxiNltw/Mab8W7A1tkNsgOpM4y2R0L0KNfQl4W23+bHXbzrnipAhcLA297yRn7zd36XI/sPs9DIaGXCbHOTweqEi1un+f/+y1/hX//b/0CZO3IrrI0HvPOtb+F7P/DH9PD+PI3mF0EdQa1E6dqWrMxxmUW7NAC+8cRxbjpxnC8/eYp89QC2yAkh0qmh3pzzSx/5Hf7gE5/m0Poq1xw5hImB3ET+xA9+SF99y/UcPTCWtm40+o7JykDqLhLV6J/9Uz/Mx37v97jv4SfJRyOMRnzbMZ6sUuY5p7c2+Ln/5Z/yr3/r47ztrXfztrvv4vixo9Tnai5dvMR8Pue+++7nE5/8NE+cPEnddBibERUee+4CXf3PuOXG6/XW6w9LEliHHaCORMiskBvBo/i2w3cdanMwLtFzXmli6fed3nu06/BdJFiHiCTRd67uLp8XO0UEnHOSqVUvPT65T7bGGOye4ehOh7mbcK39lllnvGTCjEEhthRZLpkEFs0CJyGJD2uLtYolgDSgnQ6th9yB9RqWM6gsLBqQAHla0JveZYP4Qp7j3odWEboomuWlaGxo21rzcgjX3cJB44nG8vQj9zHKS+yBEYdvfxPc9Eaw63QzixGL1U4EJYrBY7WnVO/Ck0a5FWKXFF6MEe1l3sQKxagS9WEP7/FlzLqNkRh8suBSI9Yms19VaNqOLkR8ajEhy3CFo62XPPL4UywunqPat2+PysgLSScxKkUxoljNdp0G6sUCEWFlWHL+2cd5591v5P/z//ovGWVQT5dkhdWVlRWZzxcqNhcVi7GGelqT5SV5hvzsT/yIXjx/mk9/5THGh6+hKCu26xZcQbH/CG294MFnzvP02Qv8/ufuJXY1y7qhDYLJB5APEFuQOcf66j62F0vqNpKNVq6IejUNZZ4egBj8bgh3LkOI4iNUg6Fsbk01L0rJHXiQN77u1XrX61/Lp774IGa0D7ZrNkQoBgNG192E0Y4vPfYMhIB98CTh/DnKtSEfft93sLry07zuxgOSFYXGEPBNraMilwZ4z9vv0B/60Pv5pY/8e5b1jAOr+9lc1MyXfdIfrbIx7/id3/8shs+wf98a89mMPM/xIY30uqAUw3UOrhWcee45xocO4r2nqoZ471nMZpQZFEXOaDRiB5m/EwAC6bEIIRBC7OXvwPdShdY6rHV7WL16lfLMi01qXmzV8nx96B0rzr1QYtGI7QIja/k7f+uv8Tf+65/jsdNnOXjdtcy65Ov47NkLEGFcrXJ+5nn20/fx8c99CcGyPZ/ThQgxcODAGu0yEIOADyyW2xy+9ho2FkkgRNSiGnoUQ1JM9coO1pokDNGXujEZvhqEthG+851v49W33sSpjU3s+CDVaMjs8py6ixSDNZ48t4G9sM3hA+tIaLl84SG+8vBX+cK99/Jz/9Xf5uiBQkPaaZNZg9+R9QydLrbnrFYH5fabDvGut72Fz3/pn1OurDMej9letkhW4o5cAxp45sKUZ89c4Gsnn0t2bO2Ce+6/n7/0M3+an/7xD1FWhXSapmx+WaspBhwaZ/Ln/vSP6d/7R/+SLz/6JAePXw+24PzFS6zt28fKeIULF85z8d6H+cJDJ/n5f/krafdvLOPRiEuXLiXsg80oyn2Uk2JX4qSi5atPneZTn/si1xz7kErbMl7bJ21dU89bnQxzMdGrxIATweU5DZoEPMQS9ZXvAHf2iCKCc45ux0aMvXvLPTG/V9TaI3ygeV5IZpyEiPqQkm+IARsjxrgeoBSTrKIqIfRca2PkW6S9/uI7TFHFN0vFN1jtMKHFhIYyEzCBuHURmm3QGsISFpuw3AJpQVqs6aCr6aaXYTkDAqUz6TBGn2yLvk4prCKYvJAg4CVDXZUw6aGAAzdw+K3vZ3TL3SzXbubwne9l8Mb3QqgIjTBaWRUrKk5btbSqqHpxtCajNRkRm2rYZq5xdlmlnmoWO7UoXRt02aJdSGo1rxQgK/0J2Zmr+14POyos6waxWQ+AcAS1DCfrDFf3s//6mzHlCCnGUEyI5QqhXEuf1RqhWkeH6yxa4fL5y1yaLqiGE1ZWVtHo2d68yI//yPfz3/ztv8kkSxXloLCggaZpEGMlKyqaLmjUZMUjmvwe3333q+Wv/fmf4vC+MaGZs7m5kbiGNqdZdETNWTt+I5t15FKtNHbAYN9hRvuPEIshnS1wgwmSlSyajnpZg0n2SPV0uktebpt6V5EnoTlVxVhJO5R+VJ12wNR1p8Gjb3ztdXzv+7+L0sLaeMC+a48zWV2hWSyY1S2NZFBOKPYfYbD/CObYddRq+dQ993HPA18hgCKG6XRLC5cg9DlJBP3/8Td+hh/80HfTzba4fP4s1lh8jPgodGrpbMlg32HGh6/F5xN0sM5ma9j2lmxyAM2HbC5asuGEIzfdkuD+dU2MSV4M7ynLEhFhNpvtAh52KuwQgoaQzkpUxdi+Qg+RwXBE5z2z2YzpdIp5XlbUF0UZX/15RQCg/+wxCYlzSP+ZXFcNUQZOZXl5g++46xb5Sz/7Z7nm6CHOP/0UXedZLhvG+w6Sj9ZYeOHitGa7Be9GaLlC50aMjlxPefAaWlMy75LEZVEm8NPZ088lNGxm08RJk5ausRliMtou+SkKUUV3dq27ogNCX3i/6ubDfN/3fJDNSxfZ3trg4oXzZKurxKCYahUZrhPsgAvbLRsLT0vGs+c2+Pcf+wO++vhJFk2vZG2MuMzhbFqgtE3NymhIPW80N8gPff+HeePrX8fl8+fYfPZZrMvY3trGB8HbksH6IarVQyyDxduK0f4jfO2xp/jUPfdzYYZ2Peq5Wc7VxJaBQ7RTfujD7+Jn/+yf5rprj3P+1Ck2N7ewWcH2oubSdEE2WKE8fA3V6n7Ih2g2pMFxcbpk7dBxhmsHMeWYzuQsvTDvYOmFhRdOn7nI5rwhy5Flj37WqBq6NkkDdi2+XRKDJ8+y3eKvaXxa17zCxJJ2j54d4I4xCYEbuo62bbHPO8RX9pqKqva7/EiMV3adO1O7nf3lzs9cGQOz871vmZyse6mBTW4Ss8mpV2JHLiGRuuspzz7xMJsbF7nphhsYHjzE5VOnOfnMs0xWVrn+xhuxgwEXnvwaz505y6HrbuPoTUeTIHT0PTy7r4yFl5JGSEFUUWsMKpXMO1WJgUG+D8b7Of6mjKauWT18FMo1ltOajsigUExoyHQJKrS2wIvQmTSTNWLJY4OjSXYIPQ3UqUBWSdObLZle3fblXljvg1ojYp0TQWnbTq0tpCyFtbU1rDuDGwxpJEdnc+rtGkxkFmryIgeXEcUQpCfqi2MXNw6wXDI4dA25BJbTDc6duwDNnGtPHOMdb7qD//pv/gWOr1nOn7/M8YNrEk0ShN7a2tLJyprQN7cmokUhEhqjy+m2lmtjed933C3/8O/9T/qf/9z/yObjz7Fy8DhbMw+DCdl4zMXHH6c8ehRt5mhs6cTQooREwGPRRdbKAbPtC7z6DW8BW/DYyWcwZUW32GZ7usVQAsNBArQYoOk6xIpmmRUvaN205EUlIkpoGjJjxWH4wPveq1976hQ//69+FcgxBw6Dy0CVVi0MJtjBgO2tbYrRCtEo5zcv8tzZc3Q9wGQwGEgmEILHN4bQKpNxxk/95J9ksWz5+Gfv5dR0jpRDhpMJTdPSzOZIntC+9ZlzMJkw3HcEZywXL15Asozh6n6ee+4MBM/3/dD389GPfpTlckk1GOJ6ZHjTtD34gauSpVqHtUl1aTwe4zc2oRwRQg1iabqWlbUjFEV5NeFmt0x/ISXn6h2l7N1X6pXx/vOfvF4X2De6OsiwwJ/8oXcz9Yb/5Z/9Igt1dNM52xcv48YThqsjfOeplw2zDmxUsvF+Zo1C7aljzQ033sKFU09x9tx53v6ud1N75d4vP4IRhxWhDQFEqIZDyuEoqSiGnShgEN3DjVRFJMm+W0S+78Mf0vsffox7H3ma8+cvU12zjy7AvFXIx9higO9qBMvawaO4sGS2cZaLm1PEgtUMVX+l3HAWaRtsmUm3OdcGq6+6aT8/+zM/zd/9X/8xJ0+eoW0ayCuwGb5rUQwSLb6JtM6QB2Htmhu4PKuZ1Z5Mox4ZZyIaGJQ56ms1mkmelfJ9H3qnLoPh5//FL/HU6YuMJhOm8wWqIY01NaaiUyNFnpHnFcF7Lpw/D8ZSFBVZlqeitmmJ0eMlcs1Nt3Lnm+4i0S1z2rrGGpGycMQIK5MhVqDrWkLwaczsAxjLaGXlFSeW4XDYU0/qXelNsUnZqSxLdpgl0isW7k2YURWzA+6JXtVkFDb9zTzL6XoPT1XFWUtRGIqiwDmg7ZW1vkXUFfNSI9myyMmzHEwmiN2VIGO2zbMnH+eBez/P9nQTqorpoub+rzzMvQ98hUuXN2E04P4v3cd9D3yRx598DKabEFoMgUy01ynzO+g+tRrUahDbm+caIl2TtBhFkBijYjOyaiLeDqkXwujQjRy85Q3Ech9bl5dUk30yHk9ktr2lTnY4glcYpUavKNju4tVdcpkIixmL+VQJLc6kvC5E4So1mhet3K9mlaYNXELidkk/M7M5RrI05hChcHDwwAGa5ZzQLDCxSQzjyZDJwf3k4zH5YJCMgQUyUZxJWv4iEfDJHth6/PZFNk89SXP+WQ6v5Pyx73gLf/uv/Az/63//lzm+Zlls11xzcE26plVBaZa1rq/tk9lspjFAnrl08DzkmZEityy2p5oZ+I4338I/+nv/bz70/u9k66mvIWGOoaE7+xzVNUfRHuHqu46mriEEyiIjLxyVeLbOPs2t1xzk7//3f4uf+bHvo914jvrsk7h2ynplqUxkbTxkfWUFAYlJvDwFREWC92TO7vLDRCOLeafXHirkb/yln+bP/InvZ/++AXH7IpVpyaTDdXOkWbDYuECRgfglFs/KeMDhQwd3q0PVRCPIypK2XurKMJNzpze57cSQ//Hn/jI/+Se+n2uP7SNMLzC9eJqiNFBY2mYB1uAOHSSrKuabWwmR5xyjqkwaxm3DX/4rf5G/9df+OLdcfxydbVLiGTml294kU8+rb725R0pHgiZCvDVIbpDVUcmh1SEsN1kthTLW+NllTFdzyw0nOHL4ADsNgF4l1nb1V64Ws3/+BOmKQ4foFUEN0SvfWywXlINKlkuvMcCf+ePv4h///f+Ro2tDShvJCkOsZ0wvnKWebzMoc7LM4ruW6BtYbHHo2EHwNRfPPMf2udO8/a438T/93b/Fe97+FnR+idxvU4YZRZhTaMu4dIwHBZlFkm5wLlGcRLGyI6kpCBKRxfY2vkVffcM++e/+y/+Ct915O+ORRadncN0WNFPEL8kJFCai7ZJmsU1XL4ldS545CgdZLrQ+aNN0iczvcjF5yXxrW1fW1sQawQf4wfffyU/9+I9w1113wtZ5mF+i0hrxS8Jii8JGxqsjJsMS7Rra2WWMX3J0v6Pqd3Zt58FlUqfkRejQgYWf+OG383f/q7/Jm191HfNzJxlKzcrAEdsFzXyKM8p4WJJnFvUd0XdMJiNWRgMKC7Hept48T5xdoqJm/8Dwt//GX+auO4+xudlpWRaSVxVdVI0YtQaOHz3E2rgkp8X5Bc4vKKVjfVxy7ZEDfawM7AzEowhRjEbZWaztSFjyAua0AIcP5OybDBk4JQtL8rBgZFr2j3KO7BvtcoiTvKBckcfRRCdyLvGoNUZsopiyOqqYlJaShlJrhtIydoGV0jAuHZkgxrorTcW3EyW7WCw1y0uZNlGdqSTLLbarlbzk+uuuo8wdk/X9EDJYO8ZNd72HyXhEsf8oROHIDddx4lW3Uk4Opn8ltzgJZPiUvWJLoa0m92eIkkSxRdNNGrpMQowQFUdvotmpKhFnMjSCXyZ5qOFgjG9aVYRh4VIgkqIXhw5axKVkYnVHGg2iBlskiL0FGQ3IsETxKl6ltDuJMLJXP2NXmk0twhXR7/R3A0LAKirqpMwrCT5pPhpnGY6GUkd0cwr/t7/4F7jnSw/z1aeew597Dtb347IB07PnIXjaqqTQgAQPMTlhiCpWkkKNRXEE8iZw7NA6b3vze/ju934Hb7rzNexfKUUVurbTUW6kaxpML/VprZOmrinzXGLXkNR+E7YpRMU4I0JO17aIy3nTDWv8vf/6r/Phd7+VX/rIv+Oz936Jug2ITimcI8ZAZgUrQr2cMp/PcVnGyrjk3d9xB3/1L/45Xn0Equ2SH7z7Zn7/Dz5BvdFCUeAyy1/983+Vm06sAVBVJXhPvVhqVRZiEQlt0+/vRFQ9uRN863X/yPHf/a0/x7vvfi2/9pHf5gv3fYntWU1eDDA2S4AuCi5dOEcmkfd9+APcdcersSDGuKRG45CubihyJ75tOLRvRGwiuQh/5ae/nze84/X8zh9+mt/8rd/hwuMPwGCF6sBhNM7xyxqiMBqPsGEJ88tsXzrFa+94HT/1kz/BD3zfa4gRfvzD72N66iTnzpxkMhyyuHCGd7/jLn7wg+9LerROpO06DXTkWCWI5H7Bf/vXf5b7f+JnyZrzNJdOs33hLHe/6+38qR/+PvaPwbcJMKQiGnsNfdlVidKdTf1VhPwXCBxcrSr+vO2IIRuOpd2p/FtlVAnvuG3Cv/if/zs+/8UH+Bf/6t/w9HOnuDjdQPMSaCiMS1SQdkYel4SzU8puk7AZ+dN/8of4a3/lr3B8BX7wu97K7/3GQU6ePMni8ozYNRy89jg//WM/wJEVZL5QzazD4HaFd4z2jrk9AnJUDBCv4pzw2hNj+fv/zd/UT3z28/zaR36LP/zcvSy1oO4CZjhgPCiZLjbYunyJE9ce4zvf+07e9+430HYpFNmspNOgZjBh0SgipZiqpA6aEMseCgt/8ce/k7e8+kY+9bnX8G9+5de5ePlp/HyJy3KcL1InFSOl8RzKW37mh7+bEUh0Stu0DFfWZbGs1eaDfvfdSRaN5li+564TctfNf0d/87d+m1/97d/ly8+cwy86UCFzEzJxdF0gdC2iMNu8xHgwIBfoti/j2gW33XQj3/uhD/Led93NnbcdwzSR1VJEY8eiAc1KIoZFi776tqP8wAfewy//+kdgUdPVNdPpNt/9wz/M97znrcRmidNaxbhe50hUTUoXUVGryQgtyRn2ymCYhJhv0FEB/8Vf/vP83P/wP/Dwg1/h+DXXsnn+aU5cdy0/9aMfZLWCpolqVcW4XCKRPMtUYyQzIiFEtVkmzhjpYkI3/9k/+cP4Zs4/+Sf/jCPXXMuZU6e4/sQxfuaP/xQ3HdsPPbe5yAvp/LeGWiLL5fLFM6mxdL37+XCYiTYtpt7QsvIwv5hOcTGCah+RQuadagyeUloKG2gWl1GBYIcMBwIP/A5f+uhHWDt8Pdf+sR+Fya1EGSVEntJL0olYOjXSS46/Aln7K1D5l6UF2/vvBYidlrmH01/hgd/9DerFNne/98Nw81tpzYo0atVqlEqXKhqIkhHUImokRFTFIDYTk1mCQN2hdYCvnTzNJz93D/fc/2VmdUtWDlIvbAxFlhHqOaYfUYjADqk6M4Izyh2vvo2brruG191+C9ccXhFLcjAJba2qinGZvBJwdYiqNi/EOkMHnLpQ6xe//DB/+Jkv8NBXH+PkM88yXyzxvmNQFKytTjh29DC333obt99wjJ/5498t3bLGFSVi4KGvPaP/7j98lEcfe4IsL3n/+9/P3Xe9mbUVy2yrocpMcsDwHaPhQNpl/TxAmKaeX1Ifn+eFRGDWoI8/+RQPfOkRHvnqY5w/f4ll27LdLDl4cD+ve9XtvOPut/Da264hF/CLjtIZSSL7O16MvU5Nr+rWGQtZxjbwyKPP8Ll7H+ALX0xI2IsbyUNzNBwRuo6V4YDX3n4r73nn27n7jW/gxLEBVXYl//z273yBX/43v8x4MORd73gbd73l9dx+y0Fpmk4zp6Laate2ZC4jzyrpmsjWvNGHnzrNRz/+hzz66Fd59atu58Mf/ACvuu04DqTrUIk73oBxx0dkh+fcm4iaV3T/VRWX5bSd13ndYLOS4SiXALpVwzOnNnjgwUf47Bfu5auPP8m5CxtszxaosQwLx8FJyeqw5A1veD0f+uAHuOM1x7FAF1O38OQTp/nNj/wGzzz1FNdfd4I3vfENvPMdb6PIkLPnNnV1dXWPRm2fMBMyODnWOiM+mWWrzY2Ig2WLXrycdvof/+wXOfnMac6eOU1TL4mhY//aKu942928+53v4OD+0a4V147X4l7B/xgjeZ6LD1GXdYNxGdXASdOhm9s127Mljz7+BF956BGeOXWay5tTmrYjywvWhjk/8v538s67Xs94PJaNjQ0tioI8zyWEQFmWzGYzzfN8xwVEy7IU29vAndmc60fveYgvP/Y0X/ryQzz9zHNcvLxJ3XTkecF4OEqFs0YOrk14w2texXe+427eeMdrOLQ/Uai0aTDqVUV2BASJ0s/vRMhzZHuJfvRjf8Bv/vZv0zQt3/W+P8b7/tj7OXEgE1tvq6PFS0bASZBMY98XGhQbo/S89j1umEnytJNM20wwFr5w3+P8+q/9KudOn+L6667lQ9/9ft5+1+ukbZJR30ud36bz2KyQ1NFa8tJKq+gDX36Cz3/hXu69916OHjnU38+3M6lENCbaWJFn8kfBJf2mEqYoqHEsvGieW6RryP02mVvA+WfTpq8Y0g33E4oVoisFDbiwVA0dxXAiHsfcW12xjTT3/abe8x8/wv7jN3Lb+3+UMLpJ5magSaNR8SYhAC0dThETkk/by9dyffk0SqX3qdagEloGedsnzF+nmU+567u+B25+G51MaDTDsJMwI15ygkCkTZY/vSiWNQ5jnBhxaftiLM2i07rpKPKSzBkJAfWd4o3gS/CGXaFpa9nxedmlEGS7MvbQ1J2GtiFzRoo845VWWM4a2s4T1KgrS8FCAJ02sDH1zOZLtmfzpBdpYFDkrIyHHD68wiSHEuTiuXPqg3Lw6GHRtJZi1qTJy6BI76NtwTcNq+NCtAvUy7mOBgPxXdi9GzsJM/1XiCI6nS0oqgF5WSCSArFqP2UHph2EAFUOlUldmfhAYUUsmsBnL5owRQ1IO93WYTXEDSppOri4OdULW1O2Fw1eYXu+zXg8Yn1twtrKkCp3ZBasBEQMs3lHWY4wIuRZovg2NbpcNIyGhbTdXMvKiUikbVuNUSjzgTjraGM6f7MW7VoYDiETWCyU0DUUmSOzkkLfnkD/R5UwBaVrai3LUoxzNK2nDao2K8kKIzHdS43A5hLmNWxOF2xsbjFfNlgCR9aGVJnhwIEDrI2T6+V8gaKR8dCIAOfOXVZBOXRwXVShXtaaZZmUuaWp2z3C47vjYt2xM7B5LjFC632aSRmLyQTjkB0huwi0PhmiJBlAZVgJlUOaNnmm7vA9d67jzkfTNLtJrPOBLqpal5Pn6f0r0CrqY2911p/vCBSk8++AxWLBcrnUlZWVNOpeLLQsS9krL7dcLrVt0257OBxKtJYl6DTC5hbMly3zZc32bE7XJS3m0WDA/tUVDq0Lo6yfEjUgGsgkktP2Mpo7rlCJf96bYGjdevKyIM/YvZ+dT8+MDR1js8Rol/yIxRFxvenBThGzu0JT2bO2UkQ6ybjciUbrmAzTz3ceSpfi1YULW7o6GX3d8xtUMTaTEKGNqq4osf29bUJ6FoYDoUzkA+pFo6FJsShzFmOdfBtHsunGrqyvSwvUdUdlIRsNhQvn9HOf+xwXzp/jjW97F0dfcw1RhPl8roOqJC9KCBn1MmpLQmwNM6HpDEEKxFXgSoKkjisNSSO+10CMfYy0Kmh8BR3mK7hc2tuTAYkou0dXd0fODY17HOP774ohipWIKmISEqxfasfQgG/VJiSgtNOFFnlBMSmTgncIWCuSOwFjqLuOzhiNOwq7kpCNscd55BmyXAZtlksyKwyqUqrJiOiT+8Yr0SlKjgue0gkBpG1qrQPgCiaVMDng0ANjPOMdL3oMSIho8KCtUvtaDx06KCBcns608cpkbSyjAqk9ulgmFpIoDKtCLOA1EIOnbRo1xsmL46hTED24viYBqNuoxhpKm1BaXUDnCxiPwWdg4o6oamRQWHEGNi5c0pXxUHgRd3YVMEFZWVkVOq8sWy2yXI7tm8ix/RNCgFnd6miS76LCBE/URqNv0JgQiYcmI+nahcZohdoR1FBYI6PVItFHun6UZRIKMAal7YLG6EQF5nXU0dAIeRqBNTWMBiJGS5aLRgX7AonGKyi1VyqErBSZRX2tqKPKC6nESN22LKZefSSZQGMY5I7VNTi2NiCcGKB9UMl2hexgPu+0bRsdj4ZijKGeLXUwqOT4obVdIekQI1Y9vm7Vay6ZdppMCWTPbszsrkYW29tqsgyTZSLW4knJq1umMlUVrAhVDplBpICYC8t5q1ttraPhANEoO1qx/Th794IOikxi6DRGT26dZNZI0zU6W3qNCGU1gEgSHAGJivqmR2pamHcLLZyRGKMOh0Nxzu1Ku+3YZjVNo8YYKctSqqqi6zrm87kGsZAPyYEjK2DXcpScVieEHs8SUwIi7zmrIaBOvBS5SQjvOqbrtyt7oiqoJGa6kXHpkntYYtFoVKXIDK5AHBmxXurujlIVI3HXiqNfbfVunHHX5L4/eWoR2T+p5MxGrVudYd9qLmJR79HSIYcOrEjbeH3p8wu5yyT0xgJWoFnWRLGaFRllhpSpCCOJwTWUmZHJ6gSNgbpe6kv5bX3LEibP52ftYUkCzGazZDGT5xSmkkq8GiOiodN2WZPZATYZxalTJddAoZ4sNtDNycpaHQZDlwSNNQmtGtokf2QcUaz+H5MwUyWG7u3prhLogl3T5x2NlH7rKUkpQ7yIMYljpxrxwauPETQl0nwlBYtmtq1t05BlGWU1EELQ5WxBtTKSkiA7cOkohuTYkAYYy+1G8zxntDYSmwSKaFqPxp2t1tczZ/7GCTP6Rk3PjcyKQiqT0QZlvl3rsmkZjsYJ1i1gXUJ42hgkMemULnS6nHmNve1UVTpChxqXVFd8DGQ23fOubTW2qdIvsgxjRPYCVvbWrzuWopcvb6h1Oc7lCBk+pCmM9N3rxfNTEGF9dYxziI+dakgalGWR7RG9f7EHS4jbtZqY7qvHazQGk+dkpZGVUS5bW0v1ISXILINBlZNnScg6dB2Ly2d0OBhDPqKdTbVpI9X6fgE4f/Y5XV1fQaNX1VSUiXMY4/CJWkbpDPPtRmMM5FlOmTsxPYJ+OCika7urwBY7pgc7LdgrGUiJqma5k1i32tUtWQxqsoxcwOVGsA6b5TRdoPWdxkUq8kRM0vO0SLtYqPoWYwyjqpJsOErPQddSWhW/nGk+GMhyudC6rhmPRjIaDaSta/CNWkmYgL1OR+xYWaEUVZ5+IiYpPXFWMgcuS5ja2EUlesKyY951aq2lKgtZH+UCCWHfu+3oVR3Ojq5xUeKXS9qmJVqnxjocgs0NzmXSdks1UYkdRElWE5kxDItSMgsLn0QoRES897pcLkVE2OlarbXM53PattWdhGmtJcsySdKIyekleDSo0MVkNJDZXlvVgK+VRVfjiFo6EUfUdt7gu5bBYLDHn4XeiD2lTSGyvbXFeDyRLMsJsRWjqgWl+DawNd/WUWV3Y82u8caurTdXqXQpO8bt2tvHi25enrJ/dSIuOeHpjuTgrNYdzV55qfMrmpyqfJfiR5aXYjNL3Xrtmo7gnTZNgzVCkTkGVSGWJD8qGijzQnYkFr9twgWDQSVt2+KDUFY5tEu62bZm4zF33303d7zutbjhKu3WFB0YFZMTQtC6azAxYk36jGIECVoQyMXjtAO/RLQlU4f0CVMlzTUMHZbkrs4rWMLoK4gZEUnd71UvYce+qG9ZVHc7zCtjjzTgURyxjWqtQ6wRMZLszkwkSsK6bl6ealEW2HIgrqzACJ2zhGDER6thua1WY29ptKMEunOIDYOiEGMNGiKLttWmaUCVoiioyjLprL6CBZYVIfguiWKbWl1ekRWlrI1KWRuXaQQVbFII6eYa2+SGKcRkTTUaSGg9XYyaWScmy2m9spy32vqO8XjUV+ZKDJ0aIkVVYNTKcrlUl5XyfJJ9spBIj9Z4NBQQQlDt6gVd8DiXMagGYh1UByfpQQZ8myw7PFFzk8uwqiR4j75EFRrEkA3T3xdJmq3ERHPyPmlxDIeVOFv1ryuw2N7U5WZNnhnKyjFcWyFsb6NNq3kxwhpLM5tqlhdy5PAhabpaQ8+5tDbDuEwEi+8xO4VDiqzYYT1RL5Y6q5fYnhZzJWBd7brx0jCfb5IWtVyoFaUo8qS50zY7JgFqXCbbly8qxmKso8wLsc4SYqTtOm0Xja6OKvFd4tNpV2vTLvG9tVtZlrJYNPhmqbk1UoxGqCqzrS0VEYbjgbDc1ue/jSulKrgyBx/puk47H9CQ9v+xb9fHRSZ5YaAsUe/ouk5jV+uinrGzR9wr4/D84rJbLFREKIoimSCH9MzneSHGGSSK2Nwluce+qm3bjma+qcsQGU9WZEfpq9c21aqqZEe4wzlHWZayw1WczWa6q79qLIRFokzkuRjrCNbgbb+aiKpd0zIoMinKEtGAb5dK6KgqB+NKQt3pFaO0K0lz55Ts27cu25ubuojK6tqaICIbGxfVWsf62qo09WIPF12u+js7X1I1EkXVqBKJfdJMYMnxsBJrYDavdXt7yr71dSmqguWyUWutaIwvfX4l0UrozQCsKHkmiGTSdkEjkf2rpYRASqq+w3eNts0SZwzD4fBbpYz30h2mtZYuRGIUrEVUhBCCZrmB8YjqyOHk5xZzFj6gGWRZLkUuEIPG6RyTqQqJiyPakIknkz7i0GHVY/CEXl0PBKvpRdku7Sxe0WDpZV42L8gyS3uQ5ws6pPHDiykVpQFIlDTVt1IgiWOdDM7ECQIxNa5qR2uYIvXxC4/Ol3NUOqrBgMloXVheVjQk0i8WjCX2ktQqQt3UqgjGOoo8l9GgRKPSdS3LxTf2q/tGsgsKmhUl2dCJBqVuOp1tb6mSZPiMgLNGHCBGewWn1F2GoFw+f06r4Zgsy6XpWlUfyKtK8nEhTZupb1uCRnXOMihyEe0thTS5FbwQtCXsWHMnW6/Ew7IiUgwKnBsSQmC5nOu0rnFFgvLH4CmynLXViWhS3FE0UhSF7Ho4PS+5eCO62csnahScMxRl+mebGm0XNWuTUpbzqKFpyASqfAWzuq/HxjcsL5/RalyBKQlNRCWnqCqJGtmeLTQregDFjo1UTGN+myYQ0i2XKkal6zr13jMcDmWyfx2AjY0NHQwG8pKAtVcObZC2C1qVObg82dX2ikNt26BNo+PxSGJUvPfqm6WGtsFmTgZ5Jiav2Lp8SSfjEa4qxNe1RmA4TK+5qZc6GI9lPp1q27Y6Go3JylIG1kpTNzqfzrTM9yLRrwgvREnG7PV8oYjBOCtlnjABvUYZEg3tcq5e466SEn1/muUZ1pbS+aB7r9fzr1vdNpRlheuBOVY8IQRt21ZjTwvpWt09q0m8PJPxaCiISdzdtlOTeIeyIxreE+91e3uboiikLMsdLq7sKj+pYpI9B22z0EXboWIwLsflmVgjMhwW1PWS6WyhVmLaazuD+o5mWavJhyRc/a5hve4tChbTLa3KAmuthK5FxLA6mUgXAltbW5qVlaR9fpKzeDEz9zT5V4n9WFs1qJEUNZezbc3KSoZFLivDg4QQ2N7aVIDhyip1Xb804LL/t5yzWE3P8M5qKkVAYblo1XctIlBUJfloKAwrfFNr29RqsuLbu8Ns20ZdUYlVoetUMxEpqwoW5zj16FeZbm5x82tejzt+K5l3Mq0btVVJJGgz36YqSshy0WhBRb2AF/CmR7L04lepo1NUs/5I2360LfAKFQHlZf9eMqXVXS+89Hn12OaqRbfqVRJ2kFUiJqZR6W7w3+Ga9xjc5TJqRLHOsjYeJiBBgO35QtddBlHSdRJJ1RwQeiCRy3LZVb5oa9qlV9WIM4bC2VSJvswroEnFjM63xMarcxllVUlpkmh813XJccNKMnkOSowhDc2MwVhh7cAB8U2r3ndaZIV4hfl0qopQDQZiM0vXBs2tkcxZlrNatxcNVVkwGFTSxZe6o73LpUa1PQ9WfUfbNaqqZAayUYkYI1mesVwsVXtrq3q51Bg847U18XXzoskygd0inogWSTRdo1J3SZXYZZZBXkqz7LSwToajKtXhAai9EhU1gWq0ilePrz1iCowtZGtea1RlsrIiXdJWViHRhkJoNYYOKxnWWamKTEJocblDikxUI/V8lgLOoBRewf39T7n/g9U1IXiaptWu68jznHxYSaZKs1zqYrHULMtwzokxUUOIRO+19R5BWVldla5tNbQLdc7tjhpDCIpYuqbF5QV5NZAdGpvLcimHI+naBq+7CW3X9jtRZfoexqRiUkGD7whh2WvSCpkxUjhL0kMQsiwTEUnJPcSkH5REH/Ysnq6+lqOVdVSVum3x3muWOSmqgfiuYzGfa1EMZK/4xI6822I2o207Jmvr0rQd1lrJ85zFYkFd11oUBVVVSdd1O3tM2rbVndepqoS20bJHxudZRl4Ugs16LmdH09TaNkuyzDEaDsSIqsZAiGlqYvMCj5OYqHQ9TlZ2Ep+CUpSVpOuRxtViJNH4EIpqJF2y5QYNaggiz+sEFYv2sv8imkBAqcdRAVZWxtI0rapvpWlrbduOyXgkYi0bly7ocDj6OqA0oW0bzZxFrJWo0PkORdRaJ9ZZVA2uSsVcUy/plp062zMJsozw7e4wRSBzjsKIhJD4j+QZTDse+9rXOHP6DCsHj3H0+G1keUFJloJ3CLhywFIsXpy2NsNJxZZaFrYiVBPIxzQULBhgNJB8F1KitAoWj3U1gv+6sPdv1YcStOs8g7JKiMrFVLHCoCo4fWFOb3G/Y5bUjy6EXdkgoyxDrWVuRURo61p9F8hchhUr2qlWWSZVP7Sn66ATRNGRGFFT0HWNhqwSRfA+qBijeVGIAdq2VYOIxDQCtQYysfTeFyiR8BKqL/+ptBpxuezI1keExscrSdg4FMWHHQtxAyZDSSNGFLRpFHqd1OAVESmLVK1rrx+bWZHgO6Jver/Q1MaFEFTFyotvF/tLjElJQ3dmE8ncfGeorjFoV3ucSUa5XddqZi1Z5cTXDfqSJVUqkjJaMuMQhM63GE3Pg8WIbzutnMVoq+oT/EFUEhRWEmJz0Sq2LOmMEIOlyDKyUSZdhy49ilpMIl6pETBWEGPEKIoGjZ0XpPeN6DdPxlyJ0Cp9ff+893CVSPkr2OHXbUinyRXiXEkEmrYPQy4X22+0kjKZiFh71StpfExEU+MIQAh9UhEnWNheLLQaDMX2vFlxRjAWH5OMXpQd/VGjeZGJCIRAsn+zCJ1V7ac9RpDcGgxRjUaIcXcSAuCDJs1csaLWEZ53rXRHMWnPx3KnYjMZJk8AlGWTeN95NZSunybujnT7y+2yHJcX0qYiQwDqusYYw85UYAf0syPrtvNzOx1mnhdikvwNMfaycaFLhbMIWX6le/IhXpENTExjoli6aBSTYUQVTf6+QhQjmixIEYxNC19kB7MBIUTaLqg3jjwH3wraea1yI9YY2s5rQMDZ3TSaynqjmoBeYjRobBvtx6pqBMoip2tbBRgNBrvl3kud3yTeniy+FMEaEUUEDYT+3nQ+vW9rQDKXYp/qi4p1fMsTpveeulnipVBrLaH1qk2DOMvRo0cpiyK5am9uopWoyQYJ7amC2LSk7jQSHIg4UWvUa8CHAL3sU2YMNqYK0vZ+zU4REUc0OfoKQD/yCi6ZUU3yVV1QE7tkWe9bNAaMsWlMhdndJ+7UbUI/zxdFTKQLnYoIxkHZJ0ujQkQldm0KgtoH2x78AarRCOJKidYQFQ0maSf6xmtydXDEfoOwo9TCHrUhRBBeieNA2sXuhgOR52FU+z6kL1qi7BAyRFX26s48XwNEd/rDq77G8/5v9yGSF0Gv6N5vCFcrqfYQ6567qs/bv6jIlTmvCC/cAvbdv0bNUGibJJwRA9YYchVEoloLIbTpGondAYmJ9iVGFFExJeJyMWI0dNClRhJ68YkYDajRJKSxIz0edWfkLHJFP1Wver/f+g+9auT2wrXE82+K8EK88Yt3D1fO03CyKn1i1a5LziwmxN1Ekhel0HtWaquqRhJxP0asEc0zl0jzu5CgqFYjRhOVwosQxcpLn63dZKlX6/C+xKuW3RlS/7hd/Vv9V+WP5vqTkAAie8CEeyGHVz2P0qt47tr/RZy4MscHtPMJLJREBtLjFzWo6asvVSFqTGkmuR5JnlvxXSpOMmcx4sTi1QK5NVIH1ShpABZl7zNpVTRIEqB5fhz45s6vvoiZwH9q/PhWPicvCfrJ84ygUZWItYkqoRqRyZhbbr0lDRVH68Qso1EQMf2CO2JsT0IXj6jBSK02LJBuhvXbEGbYbkouShaDgiGQI2qwiWxLLRnBvDSI13w95Hzf5LzcpGloGVtJ4vJWoTAJu92HNQJ90nISsbp3qZ4EpFArmYQEgsRZJ85l/eotgjEJzahps5B8Edmt8tQIbQwafb+DcT36sjcXdtaiKTCoIqLyPFDzH0XA7HVVrkZc7jUZS+gbVXOlTpcrfhhXOFVXf/VFu9kddOfOZEtErrhoXP3g7LzXKw+OEe33M3sT7ZUHp8cxqwCm78teTPr/yqjdqBGjOdEHRSPO5gmb2UW8ejCCGtNr/QpBDCHJhhHFpB1U5yl8UCOOLEuj+ahXqFM7IDF05/Xt4PLjHoDL1R6xO2rt3yjA/9GMZc0e0MgLE8eer12VQK4UIy99ItMzYaRpvIYQkjWdvUKEyqylsGCzNI7DCkFQa5KusjHsmgrv/EHZ85mE5RPv8KqR2VXhQV54fV/iel5dmvWJqV+t7KYFvfopEfRlY5W1x5rLVQugHfUmXkR6n/456AtYrAafzhya8CiZFbG9+YVG7RH8qSMNUaWLqiEm7L8YyFyirhgJ4tSrtjMkcziTqXqPuAKkt9HqQ6LZuYb6wlT2zZzf/r2mR/plxI+rR+3fpg4zLzLpgtL6qN7HpB6T9eq2zoGxMBph3BDbWWl9srLKxGDFIBLR6FN0sDWFNoxMy0hqCNtgFuRiAA8qOPJ+bZlsYCrJEsPo5Wwo9zQVL6/B6iDMITYkDLcH9WlsmBU99rIn9KrZM5aJyfJMjTibJ9U/VYxkaCeEkHYMzlnaLu0tUgiXK89zvwUQ7YllxuKKQkwmtBiNMSIv0AvdY/2165D4iqtcfeGVvqqyk72dGnr1OFD2JNBvVPVd1VHuDlafr+O7t4fck7gl7gaLnZZXX+CzKlcSpZq9vWj/fOtVPUj6mQJQrEWyzKKxpWkXGjViM5PkZ4h9YbEDezB9oFMyPFo3mAwp84I29PkxYTlwO4hHSa5GO1J2uzbhguwVTH/hXfhWdpvfIDi9SM///G706yVzQfFdQGNI1IDciRHBdx0xBqxAe3lDnRWszQjG9j6ZgrgMcVnfXe49H0bYdch+6Q55Z4qgVzToXyT5vGRv/NITrOeZIr/SOxTl+Qn8pZ5p4epxTOq3u7bDmOQG46RPbTEQfasaQ1/wBcRaEbE4awVBfVRiFykLI10IaqVWF5aIX6bJmoD1DTCUoHb3TF/p19N9UTG7F+XlnN90/15J/JBvb8Js21bFOlEiXdcmOoUI1DVPfPVRzpw+zR1veQfjG+5IdkwxkDknmckQomrTkqeEAHQM8Ixp0K0z8NRD1Gc3aaUiiy1pG+EQhSx6BI9K26NpX2rH+vU7TF7RYc1YasG8g6woKOmws7Ms59vYLAmpm6SAoSENIvZgx7yimUgnZFqk2i8h0tVEg1jEGUswKdiLUZX0314ZKJG1x+VQtIXOtyo+daWZair/dub0ekXjNsoO4eKF3cnLCplX8Xr0P2F0clV30Vs2yTd83Pc+IM+HFey+wauS5RVfoCtdQdzhmfXjqd2QleLaXi7fXhM+2Qss64dzkoDsnRhVCzHpP4uJDmsLSpdBJoKvFYlEif1oSnYEqrGqFAXQ1RBQgoh6I0JSo1l6r2J3Rkw7wREUI9EYUCHRxPUbXr0XBvI/itp6h3MnrxhE9yKvT1BNRbVBjCiEjhAD0XeqMWIlkOVtSmsuYqOQqxCwBI1ojCI9cEd2t847Y4RdOu7zur5vkPC+4bvTb3jFru4wX9lI9gUI/70dvL7Ua07/sgHJDWotOIlC8ISuVqLH9WAiY5TOt3SdqorFZIU4l4sxhhhVpVMGppOMTjFdqh9t2uEOcsHHVqOxRHW79K2ERPEqGkmC+eZlnt+rvX+/+fjxR/UcfFM7zI4sodswxoq0QaElbm9z+swZnnj8CY7f+CrGJyLOOVy0WGvQDrrOo5rj8jING/1CUUcMcP7sOS4uvsDZsEInBbnWWA2gaW2caYfVFpGuhx6+7B3myz60neTEYh+zTsDmZHjGLGgWU9xghbrzDMT1Eni95UvPP7IJ6kIIQa3pgRAxqDMq5EBsYVlrlSmI76Voetsz3fmvhcVSxQ3InUHbWrvQ+wXarGc8mT2HSnZlq/4oRkJ70cDynxAo9u4b9MpIb/dBv1L76tcJNnv3pfElQpi8SPezIzYe9yQ/kedtJfd0lvI8Syt5YT8lmni4FnwHJnRaGk+exTSmn88VPOBTX7mT3PYYfpMXMJ9CPgZr1LWKmByXDcXvjl1119Q59oVPAm5IUpt+UUySfsuDQpI+06/P6vrGYkJ61SRCr+YCWgFnIAav3ndYIwyKTLAG/FxpF9AuYRFBHRRDbJX4rME3qgkFyhVBg527r7udjpH4da7Vy+tDXgpV+60Yj+sVvkAPB79SQMlVw+I9z1+/LclExWgHPiAxaC4BW5g0HezfRVZYssbTBiVGrwQRMQ4H4uuFVsNcqJcwPZ8mi6LgSlg5iOtanDgJalVFsOr7z7SPDkAU+7LOr7IHiPVy4ofqt+z5eMmE6ZxDNb1aJ8noRb3HDAacOHGC1ckqhw8fTpITgLVGNBl4agwWzUbEDJYd6uIEOznOweteQ9PVzKJj3+AwnWSUcYHVVLlYDWSaAM1BMl6JibN5hdfKh8A4RMgqYtcwsRlu/ypSTKgGowQzeP7gUHdGhK0G02GyXFCv2jVY0zsUzTdozj3LcvMChXbkdOmQxTYJXsaOSMFTdcmhm17D8Ng1iLHkfke9E7ogqibrqzjp4d1y1UjU6tVQ8G86YWrUb/z70gvkXzmwcmW8uDciieg3GHjtoQywu73ZGfY+v1OUnVGwJjDPbtmSuvarIpu5Mp7rk+ZebOTVAUc13cNAQLFWsNrgdE5hA3Rz/LOPc+bxR1grhDy2OPUJ6b0DhlGINuOyKZlGx4kbXoW5tsSoYEIAclxsiWolyg6jNyV16THivSslz6dVyZXWSPgWosR5QX3/oou2b3A65HmbJ73qXGkXU4EdWsS35GUBVpXQwIXTbD/0SbrL59hcdtjRGodvuI3iupuhGOOXATdcVZ9M73o5kR27dnpl4LCrTIOqvngn840nKC/eD8mLozv37Oj0FfeZu0WjyIvBYFT2zJP2PH/9dMfg0dCpxEDmBJykgny2TWhbQgjkZQXFgDzPiBHa0KnGJArqYgOohguneOIr98ByEyOwfvg463e9q/cQzjSoJWKw2olTr0a79Mylu6Av9/yqiO4pbr+5+CE7E7JvW4cpGFNI3bTaxiW2LGkXcxwN2WjEtXe8PlXt+QDaJU3oVIqx7DwmeVXJtEGNR+sOKluJPfZqXVuZJN2yKGDH6W/EOnVY0PMdux7ZUaYgqH5P4DC9QmXvpqY7deVVu4wXjjC+6Y/Qd34K5RDqZXqdMUIT4cjNRLFJPE93krOIitFdKIBVcFFDF5IMnMnT351eZHryQb708Y8wiAsKScSUgCGGQPQtM1NwLt/HHTHw2gMHYby/T8TpfQfvkcKhEhSJEnEEydOCX8Fo7IfFihfXA2Xins4vodgSqjCoiogX10t8pWSb9b/fGUdIRj4JzJI8PxXxPZxcVNUCTgKWzqSKcwetGFKnqTYN1GTndezIHkpPjO5/PlUVsnMfg6ZkKEjc0RJNyI7Ye02k8a8F0yJ4rMYeFGRkVxAs9UqaKNayO0JCSYlsNwSG1PUjKtHjsgE2s5KbQjEtXJ7x1KNf4t7f//eMpGMQaga+pogtLqbrFYxh5gackTF2/wkG4wMcuu62pJ4eknRYG0Ek0yiK6c/+zkjJEDC6U4TYK52QPr+Wlhd03Vc8CiPJY0aTAXkfTHa6vUSEusIeTvfD7KGmp+tvets6RWhNkagaBKx6sdolkWxxEvf4D15V9GgUq77HhRsiItGYPhSqijEiRjTpM3fgW9pnn+DMw/dw7osfZ+vCWc4uhJXjN+Em+zh2wy2QCYU6Qs+SDuK0v59q+jt9RXS8R7JLolRcYUxHNVfZobFbnMtV+3PtyxZLkOT+k6BQcQfLTBDbK2KHhDdN4iUSsb1InO1BLP0KhojRKDbuiPztnM8UsIzuJN0eido7BPewHjEaEI2p9NPn7en3BD61RoL2og3GQPT4jXNcOvkQl04/hfee/ceu58CNryPbdwxjMkxMr8OaJOuJKqfPneWzX/gs3cVnyJzhpjvfzNtf/xaQApMAfz1I2vYFadx9YUZVnHYp8UomQawqFkHV0cnO2H/n7KbSJy37PQ4Vg9W4Z/XUo/TT2K6PHbEH6rF3gYl+e2klhs4binwieejIkgYRWZaq9PrcJba2LnPoxPUw2c+ADh9nisvpNNCEpeb5gKiGQQaBqLE6ginX+4tp8CZLASIdsT2Pfs/0z3JoFtBssTz7bNJfPXINuAlkQ0LsqRja9kmVnk+UJ2bgrn3Ty90ixCuHccSe8bBBNaPzipMO29/oBErIrgxKjEjXgY+lko1YiJNiOVN74Djhwkc4NDvJmpmBddjJQTbsKma0zsblixw6dJgqq9h3aIVQrRFZFe2WmlsLzopkLUtf62BUyXw5VZOPEJsnR4CIZK1X6wL19jZNuUoxqcTGJCPmJVWTlRHpZpd1OMzoZnPN9x2U7Q46H1kvM8z2HKwhlqXUWA0xYZ/K0JFJwDhP6BY4teAtzq5oF4V2mNxeZRbI8pzNLl3JlcwyMII2MzXO4opSWo/65bauDivxy5n6LlKOVmXZdpplmTRdh2SB0HXqQkaZGTE5TGdbaouKEBwxGETAuBorNZlXbDT4aNQrZHmZdDgzJ3lRsuyatORSi1Uhi6iNpH25NGDqJCZvK5oGlr7QKCUDZ4TOaLSWYqUiNJ7c5uwH4sYmB1cLpssls2KIcY48ZKwdPkpXrsAywHAAHcyDqA5HeJuEs3UZIDRJS1YUaWZUWa5ihlI3UZ0zgqZQZAwSfKe2yISoRB80qiDOShfR1qd6clgasZ3Hh1anbYcdDFFRijxTJyLTjUs6tMKgKMBZaabb2oijHI9kvpjpYDiR+TxqYR3D0sn21ky7tYpZA+ulxXiLzC7jyhxXDNisEyFOjMU4S9t6rHHQzXUwIBWc1VjObEw1G+3DOMfYIZcuX9BhkVOurlCfeZpypCy/9gke+9ivsiott990K3Y5hvXrGB2+PoWr6MEmB5UmNxrzVMdWkEzqJRBC0HkTkGJEZx1F0VODl4HcCkY7bGyZVJU0i5n6oKh1WJuJRVH1qhIpi1zq+UzJKlnYUjsP6yXSzJbkzsiy7bSYlNStqs4vUBQGzSrISpadYoxhtgmT1YT0nTWWzBgqE1WamsJa2q7G5IZsUMhyMdd23upofZ/QLpm1gXKyLpfnQdVYJhV084UOMysmNKqxS6bUCMVopLQNhBbKATGfsFymCbeC0HVarAzYfvBjXPzSJ5Mowi1v5OhNtxLbDlOVIhIp84yurtXlJSwX7L/xFtZPXMd0cYbRsODATdf16k8jusYSC6M4RxdRZ63AQuv5Nm6yj8X2TAdZ0uydd4WGYkIrFmeEygjiO/VYAlYCRkUDQ+nAOmpjWbaRoYHYdGrEMhznMq179yaxdO1cR4NM8J36pqHMcwiB0HliUUn4FhhJu5cayLReNS8QwSK+1arIoXKwdYEv3Hs/p049x3u+q+TQeB1iJMaWvKgEV7CoO7V4zJ56bWEHwOA/CexqUMkQsszq5qln+MwnP4MVeMd7v5vhtcdotJTGZCoouTbitFNQAo7WlGg/IjCvUCnoG31YDVftyiJ2F45iNO44WRKSEa4aKiwzrCpjG1ixymbbcOTON3Hk9nfA6GCvHp7DbBPWr6MrV6RRUZcNJGjExECG1yLvgEZzphBbZgHaaUNZGMUJ4CkHJa1YZvNOC2qMs2AF56DZrnUld6BLskGA2SVdNQa/fQ5rR4ouwQ7IotXNztH5gspZxGRC9ATfaZGbVAAFhdgxsIW0itaLmsOVB+0oh0Pp+l4pNC0aPc7lcmlrWwdVxShTRGea2RlZEtvWYfQguWYyBxfSA1oHiR0aDJKXpdRBVYzB9eP3ynWI6/p/yOA0w2HAtThRFu1Mt2eKsQXjalW6ZcBGs8t7BIuKRcURTcRaoRArqrlqAKSA1YPc9Jo7WVnN2DcqcO0Unn6UZz79MbY3LxDzjFvufBvuzneizYhudC2y/0aoJhC7JIFGQENGXLbkWZScTU2WEwJtDTIDWwCtlmUhYGnbQDCFZIWllUx802pmRWJoMBrJjdMyy6S0ivdBzXypxCmuKthfDcAG6XBMl0t1LtP19X2iy7niO6DTIoeiFJCZ5mYGIWgxWpE421R8p+PYsK0rhABbcxjEVtfGI2iXtPNtzVQYFQZc35bkfcFpaphvQJ5DNHp4/z7ZxGkX4cLWlh5eW5fZ5kXNuo7ywAosz3Dmwc8w8Rc5fGCV4x94F8f3v4F625EN19NESyI0HYPhuhCF6NHSBHE6U8JMoQObUU2GYIK0UVg0qBeDcxbjIHqLbzytVZXQMMwc5AHUK22b1iMOWHotQws5iillquh83qkJkWxYsbWoCTU6yFSKFatoDdqh7UKXy8jKyiFZH8P2tNOZduAiWeUojUhe2Z1LpT601N5ozEtMKGgWXovhSLSbaQhKaRXwOA90M0yRK7MNpMopCtcH0RroQKBtGhZ+pq0P7B8PxPpGGVholxzPZnh/hsxaDmczqCKmUuimmrky9bHBgysEY7Q6cIDv+M7vYPLO2yA3sH5NylhByLKS4ERaRUMbkTxAoZQjC2zqxC3TGRDDsMjARmkVprOFBhvU9BriYgRnM6msgbhUaFgxniEeJw5sSM+EN6zEli5CNEoIDb6LvU0bPY8GrMu+ZZH/JRJmWqW0ISChpXIiiE2owBjTmM1mNEnrDkxyjAia08WdkVqP3Xx5CE00BEXSHiL6DpGelK+RGDqVHdFjlP+zfQhRTeww9Gtgsf04MZUDjRTMZIQ1OU/VDdcceg3c+E6QYfLuWWzBiURt2K6jBgMjl2KF+KVK3IILX4PlBVhuwvEbGK1czyj3sNyARQODI7B2LeMsl7hs1QaP0d6YVRzjQSE0c+Xs1+DyKc6dfIx9Q/AXvopbmcCxV8Phm3EHr+NQtsYsWogWK2C0wEoJ8wt0p5+g2biEMwPKa27S4b4jjHUBj94HsykLs6Zm7RoGx2+gjYLvVz2TUSWVhe7sKV2efZSqPptsTA7fDE1AN86zXG4yGDm45lbIrlOT7ydqTjQFniQAkFukigGay8qF5/AXN6gvTYkbS4rREHN0lezYAaqVVZxUmJBhmwbrC0UN3kBrnXhrNJiMKEMEj/MtziSUt0ag7ZSixFxzM4cO7kvBo52mse79X2Q+3yZKidt/Ldx4B2IPkrNKDCVdFLLe7aGiTY499VnCyUeVxRkYlrB2HLa34fJzhGaB7juMO3KdsnocGYzZFqutWLoSGusotdGVMjJmiYQZ+JmiLU58Cpwbl+DyFpubM+pqn67e/hbyaj9NByHLUDXioir1guaZR5DleTLTIaMBXHsD6FDN+adhDFAwZoVyuCJbC9WyygXfKj5S0FEUFuqzcP5pDc89RTu7xIWzT7E6qVCNrFz3KurVmyhvuVuNOHactAyBkVNMM4dFC48/yOXTTzHKAiZvoehgYindgFgOUVsiMRCNhc7rwEShnsL2GeWpB/BnnmT78gaNWNh3mH0nbtL8xI3ko/1oHDGNBT7kOGfJqlLyLCoaiaceQrbOosspZnUNDh+Cp08RL1/EOIH911Aee4OW+T7Bq2qRS+c7hMjIdpLVlzQ88WnM/Fza5x05wb7D18N8qmAZ28i4KBLgRgWd1RouXMJWA1hdxWUV2+oIWUU+hvkSCkU7KRjjKfIWujks5urqKWQVDBQuPUc8f5bL2wu2Q86RW19PcfgmaZqgMSQan42NLp96GFluUzZnYXaBlTwhWuPWWfjKJwmj41zYWnL4NW+EtWMqsUHbqMktRiljB9PLaZJnhrC2Bg7EigRRjRoY5CKZ1srGKdh6lq2HvkSoF9R1jWYDBodOsHbdqzU/eiv7xysSll4xheysVUzsiMtNNRcepr3wZNIeX12F626HTmGrgRBVsox8bT94S+lymmgIJgPnZBlRZ5JkaHxFE8ZvdiQrkFeZLBZzNdFTlQNRH4izBXZlhbvf/g66pqMarqT1Y1GSZQNZNFEXXcdgkAuxvbJ0/2YBO72QN7Fl5dBB3vfe78SIkh0+mGCLavl6IkD/x6dQkZ1pekqTQUQNLtYKNTYsGNjAuBCOrI2SMII2YKuEDIwBmpwmWFoSSNA7NLOItg12doHP/PI/JV54DJopJ255LXLwVcxnc8az59jcnHLgtd/Jgde/Fzl2uw6tEWtN4hB2NTYGbB51/vCnuPDF/8CFJ7/MhY1LHNo/or30BE3bku2/npWb7uTIm9/NvlvvZjIYSpuAy+pyI2jG8uxZHvnD/8DFk48yHq3zxvd9L/nqCMrImc/8BhuPP8SGrLD/1e/g9g/+BPn4EMY4uqbRqFDXmzz35c/w5Cd+jX3bjzPILNX1b2Kzjsw3z6HNlNVKuOWOt5Hf9B1w69sxLscvW3VZnmhIBvCbyjMPceorn+XkU8+wnC5ot5YMBiVmYjl2601cf+cbyU+8GuyQ+da25mWZkHwGiYIGMXgxKaFT0HrPwKm6nj8eQsA2Ia0K7Gq6R6GFVqijJRtMqF3OZi2s1haqiuAt86g4B844RCIZEcI2D/32L7Dx8CcZLE4znqxQHn8Nm7MFdnaO6fYlRkePcfTVb2Lfq95Bdt3rqRjJZt2oKQuGmSGPMDYdMjtH/fRXuPzsI7DcZJgbJllOc/4yzz39DE+fPkM9PsLb1vezetshuiXMFq2OjEvVwOWLPPiZ/0jz7BcpZMn68RMcveFWnjm9wfT8aV61T3DjfWSvW5Dd9DYtgiN2pdZtS2lMiiBxG568lwtf/H2e+eoDGFEubNdMVlawsUEeeYhw4BZuXNYMbngjo8khMSsli82LOpgMQBc88Ju/THz2AVbjlIlZ0GwsePbf/jqPcS+jm9/Oa97+AbLBEA1Klg9p65qiNMrG4yy/8klOfua36TbPM687vCto84qVg4d4/RvegHvNXcjhO1nJcy4tF6gWdH6psa7xF5/ivv/wK3Qn78HVU9YOHuPw8Wt54smTbF06x1oRGR86waE3fw/jO96taifUZqA1GdWgkMx5umce58GP/hL+3GNU1YAbX/N6qlvuZOOZZ1l3AdbXoBrRbC35/OPPsT1dcE1ZsX9ljaNveBPc8CpynbDVFbjMYHNoWlgpjOAvKhtPweknmV46x+ZsgcbANYf3c+bk1zjzxMNszRcs832srYwojtyIyUuKKAy1g7jFVz/3Mc4/9Rhr3SUOzp9gZBJK+fxzT/LIv/sVNswKy+j43v3r2JUDiDEEIlYiMp/x1fu+wPKe30V9y6Hv+CDXv/UIrIp4TfZieWaosgw2L+O/8jkufvUznHzwCyjCuaVByhGTlVXWj93HbW//AOVr3qqWDDUFBpO46kA73+TSw/dw6ou/S+kvMRqNOXTLXWxse5r5HF8vOXRwnbVbXg23vhlGR7DREG0hokK99HjrktRkvwn9Nu0w+yV0zw1UNHWbCtblVCtrVEHBFaAZGgVRg2B6PT802S5HfXkdmuIMyf67zCj2rydecpFDGzAmrfVfbKJ7RRdS/g/LnAmjliFiJFEDlTxGbNyGcJG19gx66VEqC4dy4A/+ObMvfwY/OsDG5UvEleNc844/gR64XSaDgplHGwVn03Wx9Tbj+hJ2cR7TzJCzJ3n6zJyNrS2uyy9j2jlPfvQkdnGB9bf9INnBGxVjUDWMbcSaJTz9Jc596t/QPPF5ynbBu972fkZ33g3Wsf3sST7/8d+hPfUkuu8Aa0dvxAxPqIswm4PWaDFUZL7F8tTXkIsnKYwnHwjkFmJNNjuDPfcgOUPcwX0Q50kS0WR43zLMMqiE/XnLueUZDrbP4ecds7P7OTv1SH2BYdhmOb/ImWYOmw0nDh6D9Zu1DA4vDmsR52eq577Kuc//Hs985bOY4So333YbZnWCLuacvffzXPiPjzE5+RwH39nBne+BouLSQOgEyhC1CIE8Ii5mWhsIBmw2QAy4ZNgrgtWIMotCq4ZRmVEq4A3zxjPEoLagNgMo1/GhZCkDbO7IMieqnugbldBiwozh9lOY2ePsM1Pa6QYbz2ac2phzeKCsdDPiQ/fQbm4yv+wZlkcYrK/r6rTDxYJJiUgATj2ji4c+yTMPfIKLTz1EXGxS5C7p1mYZTTPjcBbYbJUqzEAieZYR1fbTUwFfs33uKQYbT2B1xvlmi+eefBK/NNjpec5xBlMMmGzD6uQg49F11NFh8lLIVHVxCZk/x6P3fJQLj3yaMs64/o538Lo7fphFA+1T93D/p36X9txZqjDjdWMH1e2Kqag3LzGYjMFmXDj9LNXZJ7kunGfULNk2A04/9hynZzOOFzdSvjFiSkvtQa2VoiqU7hIXv/Y5Tt7/u2ye/gpvuPO1DI7cTF6OCfMZX7nnszz28ce4YessxXfth4MrlKLE6BmPh0IXNHcKm2c4HM5TmTnTiy1fPfMMnWaMTaCan2f2+DlsNWJ8+BBywxup8gwrA3HGQn1J49YZuPQUw9lp6vMNZ9opF+7/LMuLZ3h9ts3KSsU2Oc92GfMwJHRCrZ5zUVlZPMYw+16Gh15LJwEb9+EUjNaSm5ly+n66z/02zzx0D9PpNhux5MLmjIcHBRNTsx4vs6/IudScY2VxEtoNFdYkCOpDxIU5Ot8gzi4S/BZtU9OGQOaSJ6f4BaELiKmQ0CTMTl7hcoF2G+oaM59itjaQ0JEv5wnPEToNrhQ1JGyLXyjPPcr5+z7BxUc/zXUHV1i79mY2q2tx5ZD5sw/z2EOf5Eltud1E5IY3I65UYoqReVXCsKTw29SnH+HopOXC6SmXtlrOTQOrmaGbXqCt4OIT93HzZAVuWgMqghrNjJEgitikqOXU9A7L3yZaSdu2VFUF3u2q6eeTFWhrvvTF+9i8vMkdr38Tq0dPEBtPt1hoXg2SIk2nam18+QbGmlwHsAYuXuDxL9+LEbjhjjfD+rU9Iurbp6358lK+vVI4iGLxSTlIG2xYcmi9xIYaG+HCcyd5/OQGYbifixfPUx59FYfe8EOUaQuHUai7hiJzWlYVjIasOEFCQ2YNhw8cptp/B8vgWa+f4NITD9CdeY75k19k7eY7kYPHIGR0wVBWox6R2DDbOEfhF6xPhoxuuhmuvwVMTj5vcdUKG5sbTB97jNHhx7h+eDOmGstggDqDYFRdXJLVG6y5lvVSYDRM6GbfUBY5+waOiTNYFuBbumWDLS1OhHa+SS4zsm4G8wtMWFILmPWDHNg34Zq11zBanmfrwc9Rb13kmUfu4/jr34mtDpC7fUgzJRtkSn2e81+7h1P3f4Js+xKve8tbyL/nw1Bk0DUcmV/iyc9+gY2vPshwcoThTXcx3LdfLksPFTMNNrYUqqpaSqTUFjAuw4cO27QqIVXbWCcxH2gQ2I4dZTGBskJE0dDSNoYuAsUQDWMxMlArydK5i5YQDbnJMGI4NnGci1tUsSNaYXLgCN1ayZGxpTn1OHnw+AvneebBB7n9VedgchsThCwobNeK3aZ55Et87VMfZ3nuSQ6Ox+w/fgKTV3gNiHRcPP0YB6uG2C4xfgmhw5lCgqLLxUyHJbC2wqRyrJaRXCzFDTdiVq9lMjpEdvkUs3t/he2ti8yfe4jVC0/A2rXkItKJA2fFB1Uz2+bimWcJiy32HxixesstcPtrGDcC2SZHH/k8W9PLLC+eYn7qKYblGuw7wWDtINFnYrKxvumt70IebZEvPoQDysEKr33De7lxcAPx8KswwyFYKzYabdtOy6GFc2d56pH72L74HAcO7mPfd303XPtGCBY7u8ixZ55g84n7uPj4lzl620nkwK1YhUE5lG62rVm3nWQO623s/CKF8QwmB3HrR2FwgGsPTGie/BRPPPEoT37lXsLkMDetHacdZ7RlrmKMGJRiMuDguKIMA7aiMhmOMOvHkJUh9rFPEp6dEYfwqte9hVfd+V782UtcuOeTXHj6Kc496Lnh+uvh6G2slgXzpUejxUmEsISTX+Lsg59i8dxjrB88zsFrb2N9HiidMO4uIc9eYCgdrshgIEkEwhhtjUWiY5QPeN0b3gy33YzzU7bv/xgXTz5MF+G6217Ndbe9jbbN2O4MZv8RICdmlTRxroUTqHIOjCqaMsfXnlVnoSqhazCDFXJT4uiE2SW9+NiXWTz1ICthyZFb3wbv+BCHD9wJVtj/h7/I01/5LJuP38PptTWO3fBaEI8E1AfQQSlSVUwqx9AGhjbiDh3gwFvfxSwOWaHm6fv+EL30BPXGM0wf/TKTY68muDGdDWSSzOCcg7b91kX2l6SVECJWrah6NKg6SbvJsFhw5vQpzpw+zY033sjq8WuwJuC7gNEMZxyBBpMw9C93B5igxNZQz7Z54vHHsEa49qZX4Q5YxCv/Z/7YMSOiHzWYXUqMAI6Fqbg8gxVnueBz1m94EwdWb2GRrVJ2NeXKUbJigmlrjVbFxA5jDR1KMLm44YrmeULiWTuAa1/Hvnf+OAwqePL3OX3mWfavdyw2zrC8fI6BUwjQeQNuJFlr2VhUeiqsMggTrhusw8YWTC+lKu/gCu/+M38RugBlBfuuTShP72m8o/FLHa40EGbQbFLQol0HwVKHEaXLmcuE1lQYDHW9hCC0ahm6XHw303xYAg3DYUlmhKpwZOU6h+76Y5w48UaQOZy8n/nTz6LTyzS+I4Ya22yDHZK1i7T7m59i+uxX4OIzHFwZkVuBc5egUTCReeiw+4Zsb3c8s3GG26dbsGYYRAgmMtDF/7+9d+vZ9Drv+37X2tybZ/vuZ8uZ4QxFUpQoUZasDW1ZUdK4SJO6RtqgBQoUBXJQoN+gn6HnPWlP2yIHRZCiDuSiSQyndhw7jixRokiKlMgZDmeGM+/22dy7tdbVg/W8JO0kCOC6Ug+e/9EcDGbu596sa61r8/9Rp3V2stJeq+gRtXSipBDxIWRWpSjJiAaEZGDdKIeVQAy41FHR00UI7RLCgEoGEJB6VRGJ4lRtTTQqjlp9VdF1AysBd+Mmd/7Gf86d61+AkYE//B7vfO9/JvaBp4PwuS7gjMF6hTIKi1Nl/YSnD3/CkycfcDCf8+LrvwFf/BqMj2Do4fFP+egf/o8s1j+nD0MuxKbcj5hCEmKf3RnqEWVZkVKkVeXmC6/Bt38LYgFP32H53v9J25+yWDxi/uAnTJ57jd4VOlBS+kI8NdQH7Jf79H6P/qSHdx/A0Zs5fT1JvPIf/nWwI9h/Hq5/BerrrAcvOi/0tEP3i0p2v/Idpep49KP/i6E/5cLPuPv11xnd+DKkGXhH0kHFe5E+KX3P8ukTFo8fMzIVuzsHMH8Z3Ev5W7MFOrnGeLrLerXi4yfPuNL0SHKIAe9tXv72DphOd7BPM33j+ue/TvHrfw/SHsxL3O+0TJcDy8HQtA1MpxSjMadNT1TRufOwfwSm4KJJaLnLwZf/Ggf/wX8BD99j+F/OaD/8EU05Y753G177Nu6td6neeYvJ9JiuXdMdP6NUIVJIsk5VIEoF50se/+xnnJycMJ3vc/u11+E7/xU3dJobA9/5I979B++xPv8It2OgGgElofIEIMYJE6e4L76ex6XCKaOH79Hev5/9kG59Hn71r1P0Jft2BNUBy1STjNPURkofQZRCI/1qSVwuMF2XqVW9EFECAWVQugXN0w8xp4/Y2amJ7hB7+BUYf16IS6WYMikEG87oHr0Dq2ModnDWo0OiG6BKgmz6Yx6cnHNw70Xsr/8nzOsjOLvP+IOf0p3/nEjgwQc/5wt9By7Tj4xJFCQK8dINqLhf4BymKJSulKENqsPAtCpEQlKaDknK4d5ePp5b8i6ocJQkhvZYo1iKsiLqZ2Yi/xJDHZoCYqEoCmazGcYIrsj8s5QSGP7/rZSxNtkefTOyKwakYGVq2vqQ6bym7woO/sbf4+Dl70JrcrdkEHA7eQIsNjopHMY5okbWQ6+zkDDGIeIJWkCqgOlmtnXK4+XALY0cP37A+OOPGGnMMwnWkQQW0enha9/i9tvf5+RPP+Z41fDD3/nH3HnnPeqRZVxP2d25RfXCy3DrGhQVLM8JImrLXSkmNYTHGrTF2sikcoxd9pGzwYAfiZQz7dSTupbQ9OAryvFcsI5uGHBDhylCJtXHRBcS7SCMJlfg6ueBlvXDj/lgVeLNHLtzFT/fB+PzFtKQT+z9OWn5jLkL7BbCuz/+IW/90Q9IkyPmo4LVe3/CrlfE1PTtkmG1wodEoRBJG6OMjkv7aK8DUa10SdUYQ7mhYqDZ1ScliBbG4xLSCl2eEZanjOoBypLKZ/MEZw0SBU0xN3JZg2Z/IC0DYD3iC2xpiPUBTJ+D2fNgBh6ZQ95uS3amezSzGyxHc3a8l65rtbY9+BbOH7NePaGPS2S8D4dX4PA5GF/PcxapZzHAXAy78zl+NtsEzaAWSzmfCqtTpVsRk+Kc43yx5KKHmZkANZgpp8uekbGYFGiXZ0y8oRqPpVuLJgPJVrjxnGrnkHS6y8cf3ad49z2WP/ufmE1H7Ls148+9AFfuwbVbECxn5x06HWs7ZP5rnWCUCvAzYr3HolnyuEncDbLpkM5g9EEsvigoqzKPErQNqW0pjSdGD8tNlmN2ICyfaW9H9EE5WZxhmxbqEa5V+tVai8oRjpe4KhDUYIuaEAZiuQvXXgZ/W4itvntmOIsjtB4x2AqqMYMaqskuQ9cS2x5rHEMULlY9xXgKV+9BcRVGPadmh3J0yLM2sHp4wj0zhat3OL5YUxQFSaBZLSlXK7RWhkHxTvClYbVc8eijj1gtLphfOYDRHHZvgDvIBKW9mxSzA3S4AOdhSDTNgI5y7m3A0baGyuzAsAYTOe6gUZ/xWXayqcdbmF+FVLLqDR4oqxLCGlLCiWE6GlMCdVHmrvjCE2LUJq4Ye8AJNg0M3RoNBae948DtcYFXs7ZMTMHubAKxY3X6GE6fwuQmVBVV6VCXw5GxDuNL6vE1wugQ7C7YORRzoqvylG3oWZ6fgUDpLX1UPEGFgNMaCT3ifoFesoJgkqUwVrBGte9VTG5LNtby1e9+J489CGD63PYrPd5mZmCIAV8fSJ8cwzBoSik75nsvaTMPWBSFqCrOmewH0HWaYbSGZr3UWVXAcoHZ3eVbf/c/zY7VpoIQP5l3/Hed7rKb9S/3FKop4ctCuqbRcjqVdrXWqqhBR5wMltbv0KwCi+oAZB+KIzocZV1IODtRR4KhgZQQCkQrQPBWoCopyoqzKJn5V8+gnIJUDMnjJ7uEp48pC8d0Ms4nDlPhi4ImbgbLm5ZX/vbfhuvC4+//IW4vcnJ2yvn7HzP2NWn5Y/avvcGtX3mVg7/2N2E2R9cdySmLYaXzQum9khzYqNihhdUFfr0AX+vF6TkUY/ph4MqNW6RBGbBcXKx0NtkRo40SE8su4kdzxCwIpoL5IU3vJPh9dbe/ydf+/n8HYQEHV2B+HeweUIIL0J9lAIAkUt9QmRndxTOOdm/B3gGlM3zxG99gvxSo5rBzF0ajPMj973FdNCZX5GVDeEAjxgpO8sxtIUCzgG7B3sjRnT5C5jGnmOlzvVLKDYVDSVFRIxscUoYldRQYtbSh4Gh0RGd3pEwNO5//hn73v5lTlI5h+hxxeo1TRc20xsUL9a4DFpyuHlPNHa20rLRnPBnRNR3lZALGUNU1fihZDz26XiMpIUZIMUHf51n5qsZaRz9ErC+px9PcZcYEHi7YZYoPp2jy2C47X3VNr24y5uMGLX3B7mTOnb/72/DjAz74yZ9x8vSY05MzVstznq0+ov/hn1Fcvcfz32rZ/erfYefaHTkeUFeA9dD26MjXUM84XnRMRzuIn3Lx5ITZXQ/lmGad8LVHjKVZrrSuLIXzGBGGYaDr+2yEYjamJhECDlOOKI2AryAJgwq+rEVDp26+B6woxnOSrbi4WLPjKugNvbfEbsTLv/Vfw+q7ucN1ekRsDf10wmkb2K0qNBaQHLasMb7AFXUugpsxK0asGNEFD6MZnZRgCnh2ShcSlStoVxfZb7sqIfXqMZTOSxygLDzWCJPxmLIsN4gWhfUaqgKMxTrHoBuHn/mcejbndEMqqUtD19VYU4ovR0obCK4m2YJmiDA7AJ0QqhmWiQy+gpjRx4lNg9s6UNRTnnUx2zb6vAbjLNaIGEUTAYbsHpTEoNZjN3Qma6Cqa0FVz88vKL0wPZpDXeeNnQjOOWkjsOGEBiznXWRvs6YhFfTK8cWaqbFYm/DO5E2DhbhcQGWyI92q0VldSUj9/yfmBe7fZXvVNq1WvqQwdoOzEphMob0gPHnM0K/zrFNvoFmxblpGOztQTnDrFcsn5+pcxaQsEWPoV5ks7r1nNh5DE3QYBvq+xznHrK4hGo3rjtQPdLGmLKrcNXp+nhuASgGXcGUhQf9N26VP7a5+ycESQXwlyThCagl9ICaFKp/CysLRpIHCQW0jtKcQziijwGDV1emTlxKTuaGF5J2eTQH6FrEOUxQbJFjML49ACgFRwTqPKxTjitzcEbOLjbdQFSrETrn4GGYlV7/8ClcZQTWB0NF8/IxH33+T42cf8f4bHQd378ArV/B+SmeidhJJ1hGrmhbDyfkFFUvwEYoW+obDac3DoWfdR2w1xowmeO/oQkEXk4pYrK+hnNJLyUWnhDp7n1RVyTGQpjep4wqkgZ0DYrlLHGpJvWrloqCDYufUs31OEyzWS1569Yu4v/WfQXWYSTOLD+HZxxB9Tgnu7WVHGeeIZjOvqeXG6LBkEE+US/ZK+jfMLKwOODVo6EBiTu85R1FX9NaRQrY4vDRtuzQINyRU7ad21L5GqinJClKMiJphwJXzUs0OkVkF1iBuj9ZNMhknBkJI+CGAtYy8pSVi+hW+X0Fc5YU1LqFUdkae8GygCQmxFooSh5MhJg1hwKXsmlSUFbaoiH2ibxb4xQmMJmAt1hUk8Zyveyo1ebzSldL0qC0hxZLF6UOmqxZu3OD2wYjbbYJ1TuFz9i5v/9Hvs+jWvP/Wn1Hf/hLV/g0thoqecc6cDwlMBCOUVYWTRGEKKltvNkdjjAzEKFgriHGggWI0phiP6Y6fUg1LYAWcwmKtHEwgDpxdrDDTfWZ7B2A9URJJBS9ObEBN17LqIy4ZpKixNhtvDIpKKcLuNWW6YeAWM2K5S6sFtoQeoO2Ya8B5j3MWTQOszyC1VCbivUOtY920TDe2dVQFRVHAIMSkOQvRN6hZIn3E+R1CbHM9MgwsLy7YHXnwCmmZZ1yTA9sxtomn7ZouFXmd3F9j/YRxmZMwvUKTrAas1JQa1KEYyrqCcgzFlHVbo72o9eCI+b8Z+jwDHZQWT2MrjDh6U1Lg8gHGZh9lh4HJnN1rtzjevcqib6mWz2DxkLE/FEynVJ7RbIeYoDM11FMwDrqBdYhKXYP3mLrG+YIhJJq2g+U5FDMoHHWdM5frtsd7v/kmA7WXjTFYnqzQaP5qeYf//hNmboM3CGKR2KvqusH5Eawb3njjRzz88Od845tf4/D5Wzx88AFv/PjH7B3s88qrrzKZjXn4L36X5dPH3Llzh/1vfIPi4oyf/NN/QkqJr3z963D7NvrWm7z1xhvs7u5y9+vfgMJz+sMf8ub9Z8xefJ3Xvv463fmC3/vd36UsPK9/9zcprkzo26hq/Z8fIdFPrQd/2RXOJFYHcaiF6Gr6tLHaMgnWZ7j2KTvxGbtmYLl8RnrjH2Gevkm7bqkmBlrDR+Y203tfZXr7HownmBAxBAqTU35qhGBgGNYQLsA14BJlf0FcnpES+NGcYrwDvoRkkdTjhwssrXY//r+5//v/G+n+n7K3O2P3i7+B+86vwnSP+v33OHznbRb3H3L25AxdPEVSB1oTYiCIZWDE9OodDp7/PO1qTbdawNOfQTmD1BNO7rNenFPPdtm7dhOqMpu9OU9IiYuuZ3cywox2oZqxbh1OgeYY6c7U+B3UC0yPwASGak/OcdoZNFmYFU6LbkJdH7F7+xWaKzc5u3jCeGhxu6Nc31yu4F/+CW/9s9/Hmwn3vvvb8O2X0ZlhbSFPyo5AHXVSlEpaY3Uw2WPLpEQSI0bcJ/V4r0FIql4CWBiGyGkzMI6WLhh8G9i7dDFESWLUqIrVIIa4McCLakdTBlMR+jUuRdywZKJLCINK7PJ9pMClidje4UCdOuo0Ah3D7k3uHdxC7v+c/tkx5v234Oo1WCh0LcOHPyGePaYy2e2IlCAMNLFXbCUxRnXWg4tY72lDIoaBWtcwChCfQdVy7gaK6YhlmvLctefAFnSbJM7IQGlEnj060ff+2fdof/oHHPmO8dV7XPlv//t8E47/jOJHPyQ9+YjTd7+P/dVvQXOTqd0laWKZKryNggyKDJQ2kpYL4mBJJwvoBaSgMAVddKQo2TwjDur29zm4c4snq/usmydw8Q5c2c+liZ++y/mT90ko127e5uD6DRCRXkWd8apRGRUVSE0xGhNdSZI1LqwgLSj6HoxXvAE/Az8BM6GVmjbmQ7hupgZIlrJwiPYUNKDn0H2IHZ5QhXOMjYxs4Ln9SR7B6c9xBFKKOF8ymUygMHjtcsNjcFp4gf05d+/e5eHTH5PaBXz0Lrz3L2EV4fwE0jlu/ZSRU/y4Ju+GhV2LSFgpJFJMuKLOPN5U5JSnsRuej4BYrC9JKVGaJJULiEaN1mYo5myfON7l3E5ABg7qGcV4jjaCN5ZChRQj+DHjq3d4sneL4/d/wJfDMazegbpSLi7o3n+HpxcNO9fvcnjvV3KtvZwTkpEQolaG7B0pQgiB0llqidCfgs6gP8PEjoDBlBPEF9l7WwPebAALKW0w7J+AbH5RxgVQjZyEPkMwxFm6LuKGgSEmlm3Hs9Nz2j6Cq4jR8Oz4jKaPPHd7zWRvj/XigpOnT9iZjtkfOggdF6fHdF1He3ZCde95uvWSxw8fkIaOuxpgSDx78oiHHz4mXV0RcSy7wONnp+zMpwQ1FEnohph3gv8WQ+WNDa/+svtn+5DLbWIdYhTxPs+XLJasmhYJgWgCfdfxwTtvsPrpz1gtF+y7huPW8ma6wyu/WfCV67cpbCUytKqhh0LAWBpbsvQ1625JSgFjImgPIdJ08KgtsLMDunKXwtYgBpMMQ8yep+UrX+bg5z/g3ff+Nc/e/4i5e5uXp4e4vT26Dz/gyZP7qFN2rxwhO7uAMPQDrrCMiorzYcnB+Iijz32VR4+Pef9Hb+K/94/pd7+POuH4wX1ktMvtL70O916FpDTrpZqixjhHF0tAZZm8noUCO1Tsuim0axjWFH4nT1GZ3Cd+2hldbqAjpoTGQJMctcwY332N5772HR784A/44bsPuPEP/iF69RarxZrlW29z3iVuPncVrt+EnTliLW5DGCeVRHV0giTx2ptsdew35t2JIruR5ECH0ahOE7V3gGOZCk5CxWDmBDejtLM8T3tZHsCQJKnTIC4b2QHCMpY8G0rSes1etJCGXNroVtC1ZOM8oRfVS3JKnpaqBDdRUsPo5otcffqY99/6AT/4k3/F/Gf3ebboCSky9pGwXtCXjmU5pglQDYEuBkpnEGOze0rqaZPlw4uIROVuFxlvbGz7GHm8aKmwNKNdptfugnhSTHTrBh1qyilcvXUXc+se7/z0jzk7P6E6GDj7g9+jTcLu+j2eHJ/S46h3j/CjGVQVqGBsotBBKu9yGlMKmmKXVX/O+ZD4+GLJrfM1HHlJ3oOI6iXIC4McXOOlX3kds3rGe3/6e7z5O/877H4fKec0Z0vOLpa89OKXuP7VX4Mr13PTYlJKJ6IYFVsKyelgS04aQQZPM0S8U7w0JEI+tWRgFq0ricbnNoMuZyxHo7Gw9rpKlqernomU3On77CPZrfn4okXXhqWfMTq6BYNADx9eBHxXIPWcNLuBrWaQSgg5I9St1pTjMfOXv0Z7+pj7b/4rHvzxG4w/7FgOSrs449ZezfDxGV3nMOMpdxoDXST4DhcbnCilGAonqMlopUWvnPfgnIE2grhcKgs93iikqHHo6PuWwo4hOU614HEqCENi2guzZFDZZL6iIXTZiUeuvcDs819nGRreeOMH3BoGPrb/hEXT0z95l1AdcO1L32HvN34LpAZbiTiHxH5jF5v9MJbRYeLA1JV5vdMO+pZFG1j3DlPW7M2PIBnoB1Q9RCGqBecR40QzLuQXFDBFSRbWwxrjK/yoFKeVUnj8wSEvfuHL3H3xJQ4P9kBqrtx4gV/7jTH1aMzV6zfAV9z+5m9x+xspj6bImGG0z+f/o7+PiODmc9Ap5cvf5eXxC4zHE7j2OWha5q+N+I2vjYiTq+Brme4e6t/6j3+bndkUP55xcXZBOT+SXi/pon8hNKpuPAN+eedM0SQFQU1wWKMkjZqjpwgyVnf1czy5/xamNvSTmlU5Zy1jqAeSXVNGuFbeYH64i1ZTkozy0iu5K5NkOfc7dId3aIsTPk6WqxcLEM+yUWR+h37XY3au0UxvMU0VqpEkjsaMUO9lFKbsfvu/1HvFlA/e+BecLM755//H/4pff8S0KnHVIZOXXmXni1+Ga8+DlhgKJtZLB4RUqymvsP/yr1P0nhgm3F+ec/LwA8QZrh/d5ujaLWbf/Jtw7RUYQGkpCi8hCVVVk7SjNSNk7xZUUF+/AaNdKAqKpGJEUKsaRDAqlOT+hEtLcnWOkIy4wxe1+tXf5OpozsmP3+btd094+ocfUE0mTK7ucvSbX+Hqq6/BvS+DNSyfneh+fZRDojGSxGhv0GByv5UBrPYYlCgu11kgg8UJCImT8xP2tGNdHGCvfRHrI4OvWYxu0CyVYiIYjRKMV6NgNaol5kgkngu3h7n+KqO4ZPbcSxmbdFl7r8pc3DNejHFs3L3pE5hkqSkhlPCFb3Jw4ybF1Vu89cb3+XCxxPqKg/2r3L55nZOTYx4fP6Utdoj1PjKeUQ4uny5FhJCUkLC7N7DPvYZJLRdul/HKQDWmMPuMZ/dwDJSj29jqEAaltsj0oOaiiXrWGt2fTOXoK9/QVfOEhz/6A9559ID0j/4HvCiVdETjmdz9FY6++G3i7W9hy+cITYtRSzd0ao2Iix4Z3cC++B3M7m32K0+6eYPjokCs1WAlu0zFpFYT61XH2Fdw7+t8LllmWnD66AFP335AK08YH13jxitf5cZXvgR3v5D9p/teZePeV3ojDL2G1YrBT4kHn2PqBdm7mefLJWZrT+dBHcGOCKbGiclMyRhwPShJiRZ2byBXXyDWY9Z2xsiOwc5pDr9E449pqpqLvS+ywwHdHNZHX8aGATeZcbH3BfbNAeepRsoaUaE3htKKcPfX9NDOOZ99jpN33+YsCWrh+udeoJ6Pkb3bLBcNYXKdY3eTyuyQXKlOOgwDLkUktNqnIPSBoZhj9m4zmc8J1R5ObZ61HxpNGxOBrs9uYGFQBgr8ldtc++rraApUz90j4nMdPygFQp8MuJFw8/N6+Gt/h9m1q/zsj7/Hh09OeO/jB7jxDneef4nnXnyVvS99G3aep10mcAlxGQjR94NWROLogOntV7l//+dM0gguVjAJsBpoil1OiqskW3L3zqsw3gMcyXgUR6sJZwoRYzds4b/6GCBN0/xbUoqC+IKLiwsdlQWjqpDQrtSLYgoHzTp/1G2bO6as29BLytwJ2nZKVQomw45TzB0Wxmb/xBijtm3LeDL5FPNiLe1qpSklRtNdWQ2itUfM6ln2NS1z6qPpHW66I6tNTbdKjTgd1GgiiaGXUpJYNf8v8FZ/JT6z1pJSthIcompyBbPKipw/1MXP/pTZ8CjvnupdKHeyqbyRnM6RAZoB5s+xHL1Ax4QqJcbeCDJAf6JcfADdKf3yhOLqHdh/OdsULp/Ck4d0yxWNrZm98BpmMpe+W2oQz1kaU1QCaziok3DyjvLhW2i/ZPH4XczpO0yODgh2H3f1Lly9CUd3oJ9AX0E1leVyUDt1UrkeGU6V9Ql89DM4fsiT9TExJa7Mj7AHt+HGy+CmhC4ivsQ6w7LpGUzJqPQSTx/q+QdvsidLytEEDl+A8VVWoQBnKN0KEUOvc+kRHUwiScQYg41QJZE6LZXwAC4eEx6dsD6+YEZFp5Fm7iluHFJfv4GYeW5mGUqh9Z9Y4wWDBJs0mkiSbDtRaIckR9BZxgAqIgwk22oyAe9L8Toox4/gZPMsk7Coj5hcuyux6zSqk9aM1KgySgssATUFQqR9/HPa4wfsFAnKERy8hJZTZFhDXaNdIpqK4CoJxmnYwHlMgiJ1UptWMU2uV54+gicP0WaFlGVuqKhH0HZ0pxdcmJrDV74O0yNZ90njkKiNQLPCOWgff0C/OsY6MKMJ9cFNUpjk2c33/jl4ZRnnTF76Sm68KypiivTGy8qOtLCJmTmD8AwevkX44G2Wjz7EDg0ptNQHN/C3XkPufY1YXmWVHKIDhXdytmi0rseIwtQnCfd/oLTPcGODTg44nb5I4+aoQqkwjStKDXRNT2Ukn+Rocjng6SNYLMEV9L6kuH4jdw+7EcSKViqGDaOxNAkzNLjQcPzgPWptGZVF3rhcuUUvU5KxVNqAONZ2Vwas2thj00BhjQxDr6pKbRr46Ic0Tx8QXcnk+h3YuwZtID16Qte0nAsc3LmNm84Yliu6hx+R2o4G2H/+BdLBNbnoRCtTZf/0EpHYUtAqNsHihNWThzTLC5wkdvbmUJfQNXQXDSsZMb3xEuxclwGQ0FAwaOoarPW0WjIqRE6+/0/VNMfU9YjyuZfh6BXpkyWsTtQ7g/paYojUhWUYem19gQ9rqpP7OeW7d5XejsWurFpjJZhGuyHgZEJZOWF4ppy9D+uP4ckD1mdn+PEcf/0eHD4PxT6rftOsaL3gSoaoGmNk1/XC+XvaPHiHYjLB+Ao5uJ679FOEBx+gzZLkPWZ2gFy/TYqWAY+ql7aLWpS15Pn3YQOl/AUEzCho9IYhBTKQBSQOSAw4MXgxGDGELmCNR8QyDBFjPcYWrLsGWxlp+0attUynGf11cXGhIQSKokBEsNaKiKCqqKqmlPKfbUGnnklppWyPNSye5e7Q+T74HVn0Jp86gDI14rX/JGAOOWAimn5pzT9GE4VTDV2HWEe3WTi9Bzc0Ug9nil1km78it02v7ViMQtUeK3IO5RJSwbP+Bp1OmQmMHGIMpNQS0oWWtdCtTqGY0NortMvAFZMgrcGtNxiHKxLUMgxrjbbkpC/xpTBxMImIdGeKDlBMhDQo4Sw3FxgDvmaNw1CJ6QXXiBpfSHe61jgp6bWncomqIJM+WEE6J0TFmT3we9JozXpApy5IIZ3SLYgKF8FRj6dSedl0oQ4KjlVjSKZEw4CzA9avcEawYURKicAFvXa4coSxE0JXi6AUxUKtiRBL6HIDCXFjxu4M0RjWQ6QfFI2GSTETm6xalcyzlB41LWo6VCIbp1NaZmgOmHm21qxVTaDtIyUwCUN2lrACyfDUTKAo2I1rJCkrOwNgHM+xJAZbi4rHWZMRXLpW1LAYKpIrSO2aaeWkWy0UEdQWJFugtkAl/ywDSOyRoUG7NePKk+dZUrY56fuciajqnHa1XhKGxXqtmWOojL0jrRtMVYNxQlGRRGjzv6JPl3BUwzieZGi2nYF4SYtTNd4SF2fYnSNW5ZzzNdRpxW5NfgdWFzCaQb8CvYCuybVoOyWZqRwvWy2cpaqncrzqtagLhgEOSsTHcyUuNkbiI5bmCiuTe4LKYWCWTvO9LmeyWgftk1B7KxVdhk6jGd5tbV6QjafrAyFGNUbwTmTo1up0yLWvssw4HVsJWIa21w7LSvK85kg7jHHSSqVEGA8XlGENlYM+0pqasvIiZq25I2oEWGmXJ1pikGIu4LikBPSxUdN3OFtuMgoxj2gATReZFjMZlit1ZqDpGtRVFPVYfFnlv9suFO1haPM8pC82Hd8ZrxWSsh6UUI4onKXozzEIa0ZMR5Vw+khl7CEkkJJYzSUAul6pWCOhqhWFYt2wblc0ownjyjIdTsEJvZnIeRf0UCdC2yvlQDBOVn2lKuB9g8Q1ZUzYYQ1VzGUVmUKxK2uEfkAnJknsW9RVJGPoA1pbldIslb6BekeGkIjLpdoQ8LIZMapKwTk09CplJYu2VbEliKfrlMpLXlZt+MVZ4wlIGHqtypzKi32fW7idJ/WBKIakBim8iMtzOTEO6opKxIFJpUYddDrfERFhtW50GAaKspR6PMlBOUbCENQ6I4gQY6SsahERFqtWx9NK2lWnhS3wh9ehaxjWPb1ba5AS44sNz+4Tm4BPgdP6y277UU3DQIp5c1AaTwSGAEMQrSeHQqhUhzVtmtEwphPUGljrjLkRbJtd/suyonDgeqTr0UTEei/RzxGMNN6o9WPAkrxlDTJSlDRAuyLQ6iLkrnhfeimjqJXcfPzxcqFX5iPBe54uoyZfM5vMpItRh9iQIjRJGXmvvg+UITEqoZyMoEas1jn4da2WtkScIZZ1TpfGiaipOF7npzH3Ls9k9gPFaMy8HkufhNV6UE0J50pJxnMRk85HRnwsEdVMuIwJqxEjiYIMYwlDh6SSFL2KL1kzIvY9NbXEoVejPVVZgy0kpWztaI2hqjONMQZViGKSKBqBmDdZGw5owhBlg+iVTwiJKoiIGp2OJ9IsV9ohlMbnzYkvpShL7SOf8P0+4ZBu3C0VQxDL2apXJzArR7JuWl2LYVpDG2pWw6CTyUxIkaAQUWIaNLMdDREhRMEXU2wxJRZGYkwslwutilKqco6Enr6LulRDPS1pm0ZTUMalx6QIvhBTJMV46YPoeZ+gsiw7pRgJbgKnHUjvML1gRlbCxnB9VBfYg31IBh2yqZJJY5oQpFSUYkQbvMRY6HQ8p794SDGbcvHsgumVHeqyomsbqMFahzHQtpGFGp3GhA8ZI5hSYigTvjIZ6ELKRUgxrBcrzd2WNWuLRikZqBEBZw2p77FasI6qYkpKp6CDOCtgLe6yQ7BPnK16gnNaTWrWAeppgd8sIzGQT0CSkwiF23TMDh0Yh3Velr1qZQsCQmNrhqHXo8mhnD/9WHec5+R8qdXOVLrYqogydjXDssH7Mq+2Btq+zS9ZmRDtEW8ZuTGpmMiyS7pYR6rCCVqKw2lR1sQQckpSwTovMfbqBcZVwXmS3EnvKlIMdG1HWVasg2XXTAUPi2Wj3dBpXZdYyfzMuInhpbFS1SNMXakA6zYBiWGS1NmCvg0a+5bCGVxVUhpkPaDRVZiiphdEV52OXAuhZxUcakQH+6lr6dB3igq+qkVTYjX0aqyQGPHsPGhVjxiPSzGa6PpBnSuki5CiqvUj0SGxbgNVXeTsiBGMQdC/vGnOX+qEqZeLhKhe4jrzx89n/FtlA1r7dKDjU3p9hqL+ZS86t+6YDDkmfEppRzKw9tI1RxVD5mmK8knQvFysfplOP6LpEmkqCUMSiyIqmsQQcZrtioI4ieI05k8Yq0EcvVrajAGWkSScWs0MckRR0ub+JjJO3pDweZxEVVwKOHoFZRC/AfwqKkLE5aem5KvSzNPLAOkNzHcDgVU0p+dVcEnE5pRgBgcbkctAcglfVpImkwOESS4bAopTAKdD7hLVmAOWWPmLrWya4bsqygbNFkGiZsD0JTw6fvJbVC1KBvuqbNL+mq9XPgGLy6cB7zNJ+o1jHUazucQG7quX/05+s+wmRBuVzd3L17QZF8n3G7PZoCUReuNVRSnSIBmylvek+T3OoOa/+P7mrI7btPYljKoIn46lXH5bKp+FRv95sPRnnJQ392GDUhazKfNvML2qn3zL8omvliGKJUnm1F9+VUaVUlsxmjRJRtcZjXp5bQnLIIVcdgLn55s23cEWSDgdMkCay2Bv5fJ36OWv/cQLK+F1EKtRRRNJ7GdKLPm7sTqoZDC2ROxnQeSfedKfThVkKDoZIL0hxuSmQP30/cBIwm7g6nljlOQSaJw2uGKrBhWXhgyLVs2/R6yky3nd/F7r5nlnULaaTeNXXhMvn4FV1U/WLPmUvmtUNk7YSTcAdrm8d5+ud39+fdHPvBOieuksld+7DSs4beDzhvjpQUOEmNu5MZv0Zbz8XlMQBMIGKu829I9gLGzWA6Ogkshvq9t8Y2kzkmXEaH7+GWTuN8/L6OU698l78VmA9OY6LteN/Nw/fcU//YaVP9/CsrmRlxtVfoE1zK222mqrrbba6i+U27a3YKutttpqq622AXOrrbbaaquttgFzq6222mqrrbYBc6utttpqq622AXOrrbbaaquttgFzq6222mqrrbYBc6utttpqq622AXOrrbbaaqutttoGzK222mqrrbbaBsytttpqq6222gbMrbbaaqutttoGzK222mqrrbbaBsytttpqq6222gbMrbbaaqutttoGzK222mqrrbbaahswt9pqq6222mobMLfaaqutttrqr1b/D6EL5X8BeCp2AAAAAElFTkSuQmCC"
            alt="DataPattern - Ensure Transformation"
            className="h-[42px] w-auto select-none object-contain"
          />
          </button>

          <div className="hidden h-7 w-px bg-[#d7e3ea] sm:block" />

          <div className="hidden sm:flex flex-col justify-center leading-tight">
            <div className="text-base font-semibold text-[#0b4572]">
              AI Recruitment Platform
            </div>
            <div className="text-xs font-medium text-[#5b7890] mt-1">
              Resume Screening &amp; Shortlisting
            </div>
          </div>

        </div>

      </header>

      {/* Main */}
      <main className="relative z-10 min-h-[calc(100vh-88px)] flex items-start justify-center px-6 pb-12 pt-6">

        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-20 items-start">

          {/* LEFT SIDE — DO NOT CHANGE */}
          <section className="hidden lg:block">

            <div className="max-w-xl">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-sm mb-6">

                <span className="w-2 h-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-medium text-slate-600">
                  Candidate Screening & Shortlisting
                </span>

              </div>

              {/* Heading */}
              <h1 className="text-5xl font-bold tracking-tight leading-[1.08] text-slate-950">

                Find the right
                <br />

                <span className="text-blue-600">
                  talent, faster.
                </span>

              </h1>

              {/* Description */}
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-lg">
                Screen resumes, compare candidates against
                job requirements, identify strong matches,
                and streamline shortlisting and candidate
                assessment through one intelligent workflow.
              </p>

              {/* Feature Cards */}
              <div className="mt-10 grid grid-cols-2 gap-4">

                <div className="rounded-2xl bg-white/80 border border-slate-200 p-5 shadow-sm">

                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-4">

                    <span className="text-blue-600 font-bold text-sm">
                      AI
                    </span>

                  </div>

                  <div className="font-semibold text-slate-900">
                    Intelligent Candidate Matching
                  </div>

                  <div className="text-sm text-slate-500 mt-1 leading-5">
                    Compare candidate profiles with job
                    requirements.
                  </div>

                </div>

                <div className="rounded-2xl bg-white/80 border border-slate-200 p-5 shadow-sm">

                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">

                    <span className="text-emerald-600 font-bold">
                      ✓
                    </span>

                  </div>

                  <div className="font-semibold text-slate-900">
                    Candidate Shortlisting
                  </div>

                  <div className="text-sm text-slate-500 mt-1 leading-5">
                    Rank candidates and focus on relevant
                    matches.
                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* RIGHT AUTHENTICATION BOX */}
          <section className="w-full max-w-md mx-auto lg:ml-auto">

            <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/10 p-8 sm:p-9">

              {/* Header */}
              <div className="mb-7">

                <div className="text-sm font-semibold text-blue-600 mb-2">
                  AI RECRUITMENT PLATFORM
                </div>

                {view === "login" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-950">
                      {isReturningUser
                        ? "Welcome back"
                        : "Welcome"}
                    </h2>

                    <p className="text-sm text-slate-500 mt-2">
                      Sign in to continue to your recruitment
                      workspace.
                    </p>
                  </>
                )}

                {view === "create" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-950">
                      Create your account
                    </h2>

                    <p className="text-sm text-slate-500 mt-2">
                      Set up your account to access the AI
                      Recruitment Platform.
                    </p>
                  </>
                )}

                {view === "forgot" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-950">
                      Forgot your password?
                    </h2>
                  </>
                )}

              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Success */}
              {successMessage && (
                <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">

                  <div className="flex items-center gap-2">

                    <span className="font-semibold">
                      ✓
                    </span>

                    <span>
                      {successMessage}
                    </span>

                  </div>

                </div>
              )}

              {/* LOGIN */}
              {view === "login" && (
                <form
                  onSubmit={handleLogin}
                  className="space-y-5"
                >

                  {/* Email */}
                  <div>

                    <label
                      htmlFor="login-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email
                    </label>

                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      autoComplete="username"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your email"
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Password */}
                  <div>

                    <div className="flex items-center justify-between mb-2">

                      <label
                        htmlFor="login-password"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={goToForgotPassword}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Forgot password?
                      </button>

                    </div>

                    <div className="relative">

                      <input
                        id="login-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        autoComplete="current-password"
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setError("");
                          setSuccessMessage("");
                        }}
                        placeholder="Enter your password"
                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <EyeIcon open={showPassword} />
                      </button>

                    </div>

                  </div>

                  {/* Remember Me */}
                  <div>

                    <label className="flex items-center gap-2 cursor-pointer">

                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) =>
                          setRememberMe(
                            event.target.checked,
                          )
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      <span className="text-sm text-slate-600">
                        Remember me
                      </span>

                    </label>

                  </div>

                  {/* Sign In */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 transition cursor-pointer"
                  >
                    Sign In
                  </button>

                  {/* Create Account */}
                  <div className="text-center pt-2">

                    <span className="text-sm text-slate-500">
                      Don't have an account?{" "}
                    </span>

                    <button
                      type="button"
                      onClick={goToCreateAccount}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Create account
                    </button>

                  </div>

                </form>
              )}

              {/* CREATE ACCOUNT */}
              {view === "create" && (
                <form
                  onSubmit={handleCreateAccount}
                  className="space-y-4"
                >

                  {/* Name */}
                  <div>

                    <label
                      htmlFor="create-name"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Full name
                    </label>

                    <input
                      id="create-name"
                      type="text"
                      value={name}
                      autoComplete="name"
                      onChange={(event) => {
                        setName(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your full name"
                      className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Email */}
                  <div>

                    <label
                      htmlFor="create-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email
                    </label>

                    <input
                      id="create-email"
                      type="email"
                      value={email}
                      autoComplete="email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your email"
                      className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Password */}
                  <div>

                    <label
                      htmlFor="create-password"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Password
                    </label>

                    <div className="relative">

                      <input
                        id="create-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        autoComplete="new-password"
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setError("");
                          setSuccessMessage("");
                        }}
                        placeholder="Create a password"
                        className="w-full h-12 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <EyeIcon open={showPassword} />
                      </button>

                    </div>

                  </div>

                  {/* Confirm Password */}
                  <div>

                    <label
                      htmlFor="confirm-password"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Confirm password
                    </label>

                    <div className="relative">

                      <input
                        id="confirm-password"
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(event) => {
                          setConfirmPassword(
                            event.target.value,
                          );
                          setError("");
                          setSuccessMessage("");
                        }}
                        placeholder="Confirm your password"
                        className="w-full h-12 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword,
                          )
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <EyeIcon
                          open={showConfirmPassword}
                        />
                      </button>

                    </div>

                  </div>

                  {/* Create Account */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 transition cursor-pointer mt-2"
                  >
                    Create Account
                  </button>

                  {/* Sign In */}
                  <div className="text-center pt-2">

                    <span className="text-sm text-slate-500">
                      Already have an account?{" "}
                    </span>

                    <button
                      type="button"
                      onClick={goToLogin}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Sign in
                    </button>

                  </div>

                </form>
              )}

              {/* FORGOT PASSWORD */}
              {view === "forgot" && (
                <form
                  onSubmit={handleForgotPassword}
                  className="space-y-5"
                >

                  <div>

                    <label
                      htmlFor="forgot-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email
                    </label>

                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      autoComplete="email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your email"
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Reset Button */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 transition cursor-pointer"
                  >
                    Send Reset Link
                  </button>

                  {/* Back */}
                  <div className="text-center">

                    <button
                      type="button"
                      onClick={goToLogin}
                      className="text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      ← Back to Sign in
                    </button>

                  </div>

                </form>
              )}

              {/* Footer */}
              <div className="mt-8 pt-5 border-t border-slate-100">

                <div className="flex items-center justify-center gap-2">

                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />

                  <p className="text-xs text-slate-400">
                    Secure candidate screening and assessment
                  </p>

                </div>

              </div>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}