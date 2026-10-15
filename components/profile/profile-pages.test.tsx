import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  getPublicProfile: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  getAvatarCleanupStatus: vi.fn(),
  currentUser: vi.fn(),
  getPublicPosts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/posts/read-post.server", () => ({ getPublicPosts: mocks.getPublicPosts }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/lib/profiles/read-profile.server", () => ({
  getOwnProfile: mocks.getOwnProfile,
  getPublicProfile: mocks.getPublicProfile,
}));
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => null,
  SignOutButton: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock("@/actions/profiles", () => ({
  createProfileAction: vi.fn(),
  updateProfileAction: vi.fn(),
}));
vi.mock("@/actions/avatars", () => ({ avatarAction: vi.fn() }));
vi.mock("@/lib/profiles/avatar-repository.server", () => ({
  getAvatarCleanupStatus: mocks.getAvatarCleanupStatus,
}));

import ProfilePage from "@/app/perfil/page";
import EditProfilePage from "@/app/perfil/editar/page";
import CompleteProfilePage from "@/app/perfil/completar/page";
import PublicProfilePage from "@/app/usuario/[username]/page";
import { ProfileDetails } from "@/components/profile/ProfileDetails";

const profile = {
  username: "ada_42",
  displayName: "Ada Lovelace",
  bio: "Perfil persistente",
  avatarUrl: null,
  role: "user" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAvatarCleanupStatus.mockResolvedValue({ pending: false, unavailable: false });
  mocks.getPublicPosts.mockResolvedValue({ status: "ready", posts: [], nextCursor: null });
  mocks.currentUser.mockResolvedValue({ firstName: "Ada", fullName: "Ada Lovelace" });
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
  mocks.notFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
});

describe("profile views", () => {
  describe("onboarding view", () => {
    it.each([
      ["unauthorized", "/sign-in"],
      ["found", "/perfil"],
    ])("redirects state %s to %s", async (status, destination) => {
      mocks.getOwnProfile.mockResolvedValue({ status, profile });
      await expect(CompleteProfilePage()).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.redirect).toHaveBeenCalledWith(destination);
      expect(mocks.currentUser).not.toHaveBeenCalled();
    });

    it("allows onboarding only after confirming the absence of a profile", async () => {
      mocks.getOwnProfile.mockResolvedValue({ status: "missing" });
      const markup = renderToStaticMarkup(await CompleteProfilePage());
      expect(markup).toContain('name="username"');
      expect(markup).toContain('name="displayName"');
      expect(mocks.currentUser).toHaveBeenCalledOnce();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("blocks onboarding on invalid role or unavailable data without fetching Clerk identity", async () => {
      mocks.getOwnProfile.mockResolvedValue({ status: "unavailable" });
      const markup = renderToStaticMarkup(await CompleteProfilePage());
      expect(markup).toContain("No pudimos cargar tu perfil");
      expect(markup).not.toContain("<form");
      expect(mocks.currentUser).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["unauthorized", "/sign-in"],
    ["missing", "/perfil/completar"],
  ])("redirects own profile state %s to %s", async (status, destination) => {
    mocks.getOwnProfile.mockResolvedValue({ status });
    await expect(ProfilePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(destination);
  });

  it("renders persistent data and a link to the public profile without private fields", async () => {
    mocks.getOwnProfile.mockResolvedValue({
      status: "found",
      profile: { ...profile, id: "private-id", clerkUserId: "private-clerk-id" },
    });
    const markup = renderToStaticMarkup(await ProfilePage());
    expect(markup).toContain("Ada Lovelace");
    expect(markup).toContain("Perfil persistente");
    expect(markup).toContain("/usuario/ada_42");
    expect(markup).toContain("/perfil/editar");
    expect(markup).not.toMatch(/private-id|private-clerk-id/);
  });

  describe("profile editing view", () => {
    it.each([
      ["unauthorized", "/sign-in"],
      ["missing", "/perfil/completar"],
    ])("redirects state %s to %s", async (status, destination) => {
      mocks.getOwnProfile.mockResolvedValue({ status });
      await expect(EditProfilePage()).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.redirect).toHaveBeenCalledWith(destination);
    });

    it.each(["user", "moderator", "admin"])("prefills only editable fields and displays the read-only role %s", async (role) => {
      mocks.getOwnProfile.mockResolvedValue({
        status: "found",
        profile: { ...profile, role, id: "private-id", clerkUserId: "private-clerk-id" },
      });
      const markup = renderToStaticMarkup(await EditProfilePage());
      expect(markup).toContain('name="username"');
      expect(markup).toContain('value="ada_42"');
      expect(markup).toContain('name="displayName"');
      expect(markup).toContain("Perfil persistente");
      expect(markup).toContain(`${profile.bio.length} de 300 caracteres`);
      expect(markup).toContain("Guardar cambios");
      expect(markup).toContain(`<strong>${role}</strong>`);
      expect(markup).not.toMatch(/private-id|private-clerk-id|name="role"|name="avatar_url"/);
    });

    it("does not display an editable form during a data outage", async () => {
      mocks.getOwnProfile.mockResolvedValue({ status: "unavailable" });
      const markup = renderToStaticMarkup(await EditProfilePage());
      expect(markup).toContain("No pudimos cargar tu perfil");
      expect(markup).not.toContain("<form");
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.getAvatarCleanupStatus).not.toHaveBeenCalled();
    });
  });

  it("presents a recoverable own outage instead of treating it as onboarding", async () => {
    mocks.getOwnProfile.mockResolvedValue({ status: "unavailable" });
    const markup = renderToStaticMarkup(await ProfilePage());
    expect(markup).toContain("Perfil no disponible");
    expect(markup).toContain('role="status"');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("uses the 404 convention for a missing public profile", async () => {
    mocks.getPublicProfile.mockResolvedValue({ status: "missing" });
    await expect(PublicProfilePage({
      params: Promise.resolve({ username: "absent_user" }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(["unavailable", "unauthorized"])("does not turn public state %s into a false 404", async (status) => {
    mocks.getPublicProfile.mockResolvedValue({ status });
    const markup = renderToStaticMarkup(await PublicProfilePage({
      params: Promise.resolve({ username: "ada_42" }),
      searchParams: Promise.resolve({}),
    }));
    expect(markup).toContain("Perfil no disponible");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("renders a public profile using its exact route parameter", async () => {
    mocks.getPublicProfile.mockResolvedValue({ status: "found", profile });
    const markup = renderToStaticMarkup(await PublicProfilePage({
      params: Promise.resolve({ username: "ada_42" }),
      searchParams: Promise.resolve({}),
    }));
    expect(mocks.getPublicProfile).toHaveBeenCalledWith("ada_42");
    expect(markup).toContain("Ada Lovelace");
    expect(markup).toContain("@ada_42");
  });

  it("shows honest empty states and renders biography as text rather than HTML", () => {
    const markup = renderToStaticMarkup(
      <ProfileDetails profile={{ ...profile, bio: "<script>unsafe</script>" }} />,
    );
    expect(markup).toContain('aria-label="Sin avatar"');
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("próximas fases");
    expect(markup).not.toContain("0 seguidores");
  });
});
