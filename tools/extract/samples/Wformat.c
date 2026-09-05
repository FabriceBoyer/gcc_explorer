// FLAGS: -Wformat=2
#include <stdio.h>
void report(long value, const char *user_fmt) {
    printf("%d\n", value);
    printf(user_fmt);
}
