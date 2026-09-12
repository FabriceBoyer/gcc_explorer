// FLAGS: -O2 -Wformat-truncation=2
#include <stdio.h>
void f(void) { char b[2]; snprintf(b, sizeof b, "%s", "hello"); }
