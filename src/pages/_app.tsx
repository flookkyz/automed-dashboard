import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import NewNavbarpage from "../components/newNavbar";
import { installMockFetch } from "../mocks";

// Runs before any component mounts, so the first fetch already hits the mock.
installMockFetch();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Dashboard</title>
      </Head>
      {/* Navbar mounted once for the whole app so it's visible on every page */}
      <NewNavbarpage />
      {/* Page content remains responsible for layout spacing (e.g., ml-64) */}
      <Component {...pageProps} />
    </>
  );
}
