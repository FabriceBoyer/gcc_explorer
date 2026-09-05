// FLAGS: -Wall -Wextra
#include <stdio.h>
int main(int argc, char **argv) {
    int unused;
    unsigned n = 3;
    if (argc < n)
        printf("%d\n", (long) argc);
    return 0;
}
