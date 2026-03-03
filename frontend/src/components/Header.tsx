function Header() {
  function toggleTheme() {
    document.documentElement.classList.toggle("light");
  }
  return (
    <div class="bg-teal-700 w-full h-10 flex items-center px-10">
      <a
        class="w-full text-yellow-500 text-center text-3xl text-shadow-[3px_3px_0px_#000]"
        href="/"
      >
        SOLIDSKRIBBLE
      </a>
      {/*<button class="text-text-muted" onClick={toggleTheme}>
        THEME TOGGLE
      </button>*/}
    </div>
  );
}

export default Header;
