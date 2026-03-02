function Header() {
  function toggleTheme() {
    document.documentElement.classList.toggle("light");
  }
  return (
    <div class="bg-bg w-full h-10 flex items-center px-10 *:text-xl">
      <p class="mr-auto text-text-muted">SOLID_SKRIBBLE</p>
      <button class="text-text-muted" onClick={toggleTheme}>
        THEME TOGGLE
      </button>
    </div>
  );
}

export default Header;
