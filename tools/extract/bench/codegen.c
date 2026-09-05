/*
 * Compile-time benchmark.
 *
 * Deliberately gives the optimiser a lot to chew on in few source lines: the
 * X-macro instantiates the same family of routines 64 times, each with a
 * different constant, so inlining, unrolling, vectorisation and interprocedural
 * analysis all have real work to do. Compiling this with and without a flag is
 * what gives the "build impact" figure.
 */
#include <stddef.h>
#include <string.h>
#include <stdlib.h>

#define REPEAT64(X) \
  X(0) X(1) X(2) X(3) X(4) X(5) X(6) X(7) X(8) X(9) X(10) X(11) \
  X(12) X(13) X(14) X(15) X(16) X(17) X(18) X(19) X(20) X(21) X(22) X(23) \
  X(24) X(25) X(26) X(27) X(28) X(29) X(30) X(31) X(32) X(33) X(34) X(35) \
  X(36) X(37) X(38) X(39) X(40) X(41) X(42) X(43) X(44) X(45) X(46) X(47) \
  X(48) X(49) X(50) X(51) X(52) X(53) X(54) X(55) X(56) X(57) X(58) X(59) \
  X(60) X(61) X(62) X(63)

typedef struct node { struct node *next; long key; long payload[4]; } node;

#define GEN(N)                                                              \
  static long reduce_##N(const long *a, size_t n) {                         \
    long acc = (N) + 1;                                                     \
    for (size_t i = 0; i < n; ++i) acc = acc * 31 + (a[i] ^ (N));           \
    return acc;                                                             \
  }                                                                         \
  static void transform_##N(long *dst, const long *src, size_t n) {         \
    for (size_t i = 0; i < n; ++i)                                          \
      dst[i] = (src[i] << ((N) % 7)) - (src[i] >> ((N) % 5)) + (N);         \
  }                                                                         \
  static long walk_##N(const node *head) {                                  \
    long acc = 0;                                                           \
    while (head) { acc += head->key ^ head->payload[(N) % 4]; head = head->next; } \
    return acc;                                                             \
  }                                                                         \
  long kernel_##N(long *dst, const long *src, size_t n, const node *head) { \
    transform_##N(dst, src, n);                                             \
    long r = reduce_##N(dst, n) + walk_##N(head);                           \
    if (r < 0) { long *tmp = malloc(n * sizeof *tmp);                       \
      if (!tmp) return -1; memcpy(tmp, dst, n * sizeof *tmp);               \
      r += reduce_##N(tmp, n); free(tmp); }                                 \
    return r;                                                               \
  }

REPEAT64(GEN)

#define CALL(N) acc += kernel_##N(dst, src, n, head);

long codegen_all(long *dst, const long *src, size_t n, const node *head) {
  long acc = 0;
  REPEAT64(CALL)
  return acc;
}
