// FLAGS: -Wcast-qual
char *unconst(const char *s) {
    return (char *) s;
}
