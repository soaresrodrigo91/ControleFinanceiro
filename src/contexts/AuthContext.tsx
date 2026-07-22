"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { garantirUsuarioSemeado } from "@/lib/config";
import { atualizarPerfil } from "@/lib/perfil";

type AuthContextValue = {
  usuario: User | null;
  carregando: boolean;
  cadastrar: (nome: string, sobrenome: string, email: string, senha: string) => Promise<void>;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  redefinirSenha: (email: string) => Promise<void>;
  alterarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        await garantirUsuarioSemeado(
          user.uid,
          user.displayName ?? "",
          "",
          user.email ?? ""
        );
        const chaveConectado = `authConectado_${user.uid}`;
        if (sessionStorage.getItem(chaveConectado) !== "true") {
          sessionStorage.setItem(chaveConectado, "true");
          sessionStorage.setItem(`authNovoLogin_${user.uid}`, "true");
        }
      }
      setUsuario(user);
      setCarregando(false);
    });
  }, []);

  async function cadastrar(nome: string, sobrenome: string, email: string, senha: string) {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(credencial.user, { displayName: `${nome} ${sobrenome}`.trim() });
    await garantirUsuarioSemeado(credencial.user.uid, nome, sobrenome, email);
    // garantirUsuarioSemeado só grava na primeira vez; o listener de onAuthStateChanged
    // pode vencer essa corrida com nome/sobrenome em branco, então força os valores certos aqui.
    await atualizarPerfil(credencial.user.uid, { nome, sobrenome, telefone: "" });
    setUsuario(credencial.user);
  }

  async function entrar(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha);
  }

  async function sair() {
    const uid = auth.currentUser?.uid;
    await signOut(auth);
    if (uid) {
      sessionStorage.removeItem(`authConectado_${uid}`);
      sessionStorage.removeItem(`mesSelecionado_${uid}`);
    }
  }

  async function redefinirSenha(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function alterarSenha(senhaAtual: string, novaSenha: string) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("Nenhum usuário autenticado.");
    }
    const credencial = EmailAuthProvider.credential(auth.currentUser.email, senhaAtual);
    await reauthenticateWithCredential(auth.currentUser, credencial);
    await updatePassword(auth.currentUser, novaSenha);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, cadastrar, entrar, sair, redefinirSenha, alterarSenha }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
