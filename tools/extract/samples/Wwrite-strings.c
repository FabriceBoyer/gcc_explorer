// FLAGS: -Wwrite-strings
char *label(void) {
    char *s = "constant";
    return s;
}
